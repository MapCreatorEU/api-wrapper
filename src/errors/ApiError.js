/*
 * BSD 3-Clause License
 *
 * Copyright (c) 2018, MapCreator
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

/**
 * Errors generated by the API
 */
export default class ApiError {
  /**
   * @param {AxiosError} error - Axios error
   * @param {AxiosRequestConfig} error.config - Request config
   * @param {XMLHttpRequest|ClientRequest} request - Request
   * @param {AxiosResponse} response - Response
   */
  constructor ({ config, request, response }) {
    this._config = config;
    this._response = response;
    this._request = request;

    this._code = response.status;

    const { type, message, trace } = response.data.error;

    this._type = type;
    this._message = message;
    this._trace = [];

    // Only available when the api is in debug mode
    if (typeof trace === 'string') {
      this._trace = ApiError._parseTrace(trace);
    }
  }

  /**
   * Get the request config
   * @return {AxiosRequestConfig} - Request config
   */
  get config () {
    return this._config;
  }

  /**
   * Get the axios response
   * @return {AxiosResponse} - Axios response
   */
  get response () {
    return this._response;
  }

  /**
   * Get the axios request
   * @return {Object} - Request object
   */
  get request () {
    return this._request;
  }

  /**
   * Error type
   * @returns {String} - Error type
   */
  get type () {
    return this._type;
  }

  /**
   * Error message
   * @returns {String} - Error message
   */
  get message () {
    return this._message;
  }

  /**
   * Http error code
   * @returns {Number} - Http error code
   */
  get code () {
    return this._code;
  }

  /**
   * Returns if the error contained a stacktrace that has been parsed
   * This should only be true if the API is in debug mode.
   * @returns {boolean} - If the Error contains a stacktrace
   */
  get hasTrace () {
    return this._trace.length > 0;
  }

  /**
   * Get the parsed stacktrace from the error
   * @returns {Array<{line: Number, file: String, code: String}>} - Stacktrace
   */
  get trace () {
    return this._trace;
  }

  /**
   * Display-able string
   * @returns {string} - Displayable error string
   */
  toString () {
    return `[${this._code}] ${this._type}: ${this._message}`;
  }

  static _parseTrace (input) {
    // https://regex101.com/r/64cAbt/1
    const regex = /^#(\d+)\s(?:(.*?)\((\d+)\)|(.*?)):\s(.*?)$/gm;
    const output = [];

    let match;

    // eslint-disable-next-line no-cond-assign
    while ((match = regex.exec(input)) !== null) {
      // This is necessary to avoid infinite loops with zero-width matches
      if (match.index === regex.lastIndex) {
        regex.lastIndex++;
      }

      output.push({
        line: match[3],
        file: match[2] || match[4],
        code: match[5],
      });
    }

    return output;
  }
}
