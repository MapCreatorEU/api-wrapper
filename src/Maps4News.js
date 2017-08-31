/*
 * BSD 3-Clause License
 *
 * Copyright (c) 2017, MapCreator
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 *  Redistributions of source code must retain the above copyright notice, this
 *   list of conditions and the following disclaimer.
 *
 *  Redistributions in binary form must reproduce the above copyright notice,
 *   this list of conditions and the following disclaimer in the documentation
 *   and/or other materials provided with the distribution.
 *
 *  Neither the name of the copyright holder nor the names of its
 *   contributors may be used to endorse or promote products derived from
 *   this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
 * FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
 * DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
 * SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
 * CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
 * OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

// Polyfill for terrible browsers (looking at you IE)
if (!global._babelPolyfill) {
  require('babel-polyfill');
}

import {
  Choropleth,
  Color,
  Contract,
  Dimension,
  DimensionSet,
  Faq,
  Feature,
  Font,
  FontFamily,
  Highlight,
  InsetMap,
  Job,
  JobShare,
  JobType,
  Language,
  Layer,
  Mapstyle,
  MapstyleSet,
  Notification,
  Organisation,
  Permission,
  PlaceName,
  Svg,
  SvgSet,
  SvgSetType,
  User,
} from './crud';
import ResourceBase from './crud/base/ResourceBase';

import ApiError from './errors/ApiError';
import ValidationError from './errors/ValidationError';
import DummyFlow from './oauth/DummyFlow';
import OAuth from './oauth/OAuth';
import ResourceCache from './ResourceCache';
import ResourceProxy from './ResourceProxy';
import {fnv32a} from './utils/hash';
import {isParentOf} from './utils/reflection';
import {makeRequest} from './utils/requests';

/**
 * Base API class
 * @todo Add setting to disable console.warn
 */
export default class Maps4News {
  /**
   * @param {OAuth} auth - Authentication flow
   * @param {string} host - Remote API host
   */
  constructor(auth = new DummyFlow(), host = process.env.HOST) {
    this.auth = auth;
    this.host = host;

    const bool = (str) => str.toLowerCase() === 'true';

    /**
     * Defaults for common parameters. These are populated during the build process using the `.env` file.
     * @type {{perPage: number, cacheEnabled: boolean, cacheSeconds: number, shareCache: boolean}}
     */
    this.defaults = {
      perPage: Number(process.env.PER_PAGE),
      cacheEnabled: bool(process.env.CACHE_ENABLED),
      cacheSeconds: Number(process.env.CACHE_SECONDS),
      shareCache: bool(process.env.CACHE_SHARED),
      autoUpdateSharedCache: bool(process.env.CACHE_SHARED_AUTO_UPDATE),
      dereferenceCache: bool(process.env.CACHE_DEREFERENCE_OUTPUT),
    };

    this._cache = new ResourceCache(this);
  }

  /**
   * Get api version
   * @returns {string} - Api version
   * @constant
   */
  get version() {
    return 'v1';
  }

  /**
   * Get the shared cache instance
   * @returns {ResourceCache} - Shared cache instance
   */
  get cache() {
    return this._cache;
  }

  /**
   * Get authentication provider instance
   * @returns {OAuth} - OAuth instance
   */
  get auth() {
    return this._auth;
  }

  /**
   * Set authentication provider instance
   * @param {OAuth} value -- OAuth instance
   */
  set auth(value) {
    if (!isParentOf(OAuth, value)) {
      throw new TypeError('auth must be an instance of OAuth');
    }

    this._auth = value;
  }

  /**
   * Test if the client is authenticated with the api and has a valid token
   * @returns {boolean} - If the client is authenticated with the api
   */
  get authenticated() {
    return this.auth.authenticated;
  }

  /**
   * The current host
   * @returns {string} - The current host
   */
  get host() {
    return this._host;
  }

  /**
   * The remote host
   * @param {string} value - A valid url
   */
  set host(value) {
    value = value.replace(/\/+$/, '');
    this._host = value;
    this.auth.host = value;
  }

  /**
   * Authenticate with the api using the authentication method provided.
   * @returns {Promise} - Resolves with {@link Maps4News} instance and rejects with {@link OAuthError}
   */
  authenticate() {
    return new Promise((resolve, reject) => {
      this.auth.authenticate().then(() => {
        this.auth.token.save();

        resolve(this);
      }).catch(reject);
    });
  }

  /**
   * Request an url using the API token (if available)
   * @param {string} url - Relative or absolute url, api version will be prepended to relative urls
   * @param {string} method - Http method
   * @param {string|object} data - Raw string or object. If an object is passed it will be encoded
   *                               and the content-type will be set to `application/json`
   * @param {object} headers - Any headers that should be set for the request
   * @param {string} responseType - The XmlHttpRequest type
   * @param {boolean} raw - When set to true the promise will resolve with the request object
   * @returns {Promise} - Resolves with either an object or the raw data by checking the `Content-Type` header and rejects with {@link ApiError}
   */
  request(url, method = 'GET', data = {}, headers = {}, responseType = '', raw = false) {
    if (!url.startsWith('http')) {
      // Removes '/' at the start of the string (if any)
      url = url.replace(/(^\/+)/, () => '');
      url = `${this._host}/${this.version}/${url}`;
    }

    if (this.authenticated) {
      headers.Authorization = this.auth.token.toString();
    }

    return new Promise((resolve, reject) => {
      makeRequest(url, method, data, headers, responseType).then(request => {
        if (request.getResponseHeader('Content-Type') !== 'application/json') {
          resolve(raw ? request : request.response);
        } else {
          const response = JSON.parse(request.responseText);

          if (!response.success) {
            const err = response.error;

            if (!err.validation_errors) {
              const apiError = new ApiError(err.type, err.message, request.status);

              if (apiError.type === 'AuthenticationException' && apiError.message === 'Unauthenticated' && apiError.code === 401) {
                console.warn('Lost Maps4News session, please re-authenticate');

                this.auth.forget();
              }

              reject(apiError);
            } else {
              reject(new ValidationError(err.type, err.message, request.status, err.validation_errors));
            }
          } else {
            // Return an empty object if no data has been sent
            // instead of returning undefined.
            resolve(raw ? request : response.data || {});
          }
        }
      }).catch(request => {
        const err = JSON.parse(request.responseText).error;

        reject(new ApiError(err.type, err.message, request.status));
      });
    });
  }

  /**
   * Static proxy generation
   * @param {string|function} Target - Constructor or url
   * @returns {ResourceProxy} - A proxy for accessing the resource
   * @example
   * api.static('/custom/resource/path/{id}/').get(123);
   *
   * @example
   * class FooBar extends ResourceBase {
   *    get resourceName() {
   *      return 'custom';
   *    }
   * }
   *
   * api.static(FooBar)
   *   .get(1)
   *   .then(console.log);
   */
  static(Target) {
    if (isParentOf(ResourceBase, Target)) {
      return new ResourceProxy(this, Target);
    }

    const Constructor = class AnonymousResource extends ResourceBase {
      get resourceName() {
        return 'anonymous';
      }

      get resourcePath() {
        return String(Target);
      }
    };

    Object.defineProperty(Constructor, 'name', {value: `AnonymousResource_${fnv32a(String(Target))}`});

    return this.static(Constructor);
  }

  /**
   * Choropleth accessor
   * @see {@link Choropleth}
   * @returns {ResourceProxy} - A proxy for accessing the resource
   */
  get choropleths() {
    return this.static(Choropleth);
  }

  /**
   * Color accessor
   * @see {@link Color}
   * @returns {ResourceProxy} - A proxy for accessing the resource
   */
  get colors() {
    return this.static(Color);
  }

  /**
   * Contract accessor
   * @see {@link Contract}
   * @returns {ResourceProxy} - A proxy for accessing the resource
   */
  get contracts() {
    return this.static(Contract);
  }

  /**
   * Dimension accessor
   * @see {@link Dimension}
   * @returns {ResourceProxy} - A proxy for accessing the resource
   */
  get dimensions() {
    return this.static(Dimension);
  }

  /**
   * Dimension set accessor
   * @see {@link DimensionSet}
   * @returns {ResourceProxy} - A proxy for accessing the resource
   */
  get dimensionSets() {
    return this.static(DimensionSet);
  }

  /**
   * Faq accessor
   * @see {@link Faq}
   * @returns {ResourceProxy} - A proxy for accessing the resource
   */
  get faqs() {
    return this.static(Faq);
  }

  /**
   * Feature accessor
   * @see {@link Feature}
   * @returns {ResourceProxy} - A proxy for accessing the resource
   */
  get features() {
    return this.static(Feature);
  }

  /**
   * Font accessor
   * @see {@link Font}
   * @returns {ResourceProxy} - A proxy for accessing the resource
   */
  get fonts() {
    return this.static(Font);
  }

  /**
   * FontFamily accessor
   * @see {@link FontFamily}
   * @returns {ResourceProxy} - A proxy for accessing the resource
   */
  get fontFamilies() {
    return this.static(FontFamily);
  }

  /**
   * Highlight accessor
   * @see {@link Highlight}
   * @returns {ResourceProxy} - A proxy for accessing the resource
   */
  get highlights() {
    return this.static(Highlight);
  }

  /**
   * InsetMap accessor
   * @see {@link InsetMap}
   * @returns {ResourceProxy} - A proxy for accessing the resource
   */
  get insetMaps() {
    return this.static(InsetMap);
  }

  /**
   * Job accessor
   * @see {@link Job}
   * @returns {ResourceProxy} - A proxy for accessing the resource
   */
  get jobs() {
    return this.static(Job);
  }

  /**
   * JobShare accessor
   * @see {@link JobShare}
   * @returns {ResourceProxy} - A proxy for accessing the resource
   */
  get jobShares() {
    return this.static(JobShare);
  }

  /**
   * JobType accessor
   * @see {@link JobType}
   * @returns {ResourceProxy} - A proxy for accessing the resource
   */
  get jobTypes() {
    return this.static(JobType);
  }

  /**
   * Language accessor
   * @see {@link Language}
   * @returns {ResourceProxy} - A proxy for accessing the resource
   */
  get languages() {
    return this.static(Language);
  }

  /**
   * Layer accessor
   * @see {@link Layer}
   * @returns {ResourceProxy} - A proxy for accessing the resource
   */
  get layers() {
    return this.static(Layer);
  }

  /**
   * Mapstyle accessor
   * @see {@link Mapstyle}
   * @returns {ResourceProxy} - A proxy for accessing the resource
   */
  get mapstyles() {
    return this.static(Mapstyle);
  }

  /**
   * MapstyleSet accessor
   * @see {@link MapstyleSet}
   * @returns {ResourceProxy} - A proxy for accessing the resource
   */
  get mapstyleSets() {
    return this.static(MapstyleSet);
  }

  /**
   * Notification accessor
   * @see {@link Notification}
   * @returns {ResourceProxy} - A proxy for accessing the resource
   */
  get notifications() {
    return this.static(Notification);
  }

  /**
   * Organisation accessor
   * @see {@link Organisation}
   * @returns {ResourceProxy} - A proxy for accessing the resource
   */
  get organisations() {
    return this.static(Organisation);
  }

  /**
   * Permission accessor
   * @see {@link Permission}
   * @returns {ResourceProxy} - A proxy for accessing the resource
   */
  get permissions() {
    return this.static(Permission);
  }

  /**
   * PlaceName accessor
   * @see {@link PlaceName}
   * @returns {ResourceProxy} - A proxy for accessing the resource
   */
  get placeNames() {
    return this.static(PlaceName);
  }

  /**
   * Svg accessor
   * @see {@link Svg}
   * @returns {ResourceProxy} - A proxy for accessing the resource
   */
  get svgs() {
    return this.static(Svg);
  }

  /**
   * SvgSet accessor
   * @see {@link SvgSet}
   * @returns {ResourceProxy} - A proxy for accessing the resource
   */
  get svgSets() {
    return this.static(SvgSet);
  }

  /**
   * SvgSetType accessor
   * @see {@link SvgSetType}
   * @returns {ResourceProxy} - A proxy for accessing the resource
   */
  get svgSetTypes() {
    return this.static(SvgSetType);
  }

  /**
   * User accessor
   * @see {@link User}
   * @returns {ResourceProxy} - A proxy for accessing the resource
   */
  get users() {
    return this.static(User);
  }

  /**
   * Test if XHR requests can be made
   * @returns {Promise} - resolves/rejects with the HTTP response status code. Rejects if status code != 2xx
   */
  testXhr() {
    return new Promise((resolve, reject) => {
      makeRequest(`${this.host}/favicon.ico`)
        .then(x => resolve(x.status))
        .catch(x => reject(x.status));
    });
  }

  /**
   * Forget the current session
   * This will clean up any stored OAuth states stored using {@link StateContainer} and any OAuth tokens stored in
   * cookies or localStorage.
   * @returns {void}
   */
  logout() {
    this.auth.forget();
  }
}
