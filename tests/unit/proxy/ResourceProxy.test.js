/*
 * BSD 3-Clause License
 *
 * Copyright (c) 2020, Mapcreator
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


import Mapcreator from '../../../src/Mapcreator';
import nock from 'nock';

const api = new Mapcreator('token', 'https://example.com');

test('get should return a result on success', async () => {
  nock('https://example.com').get('/v1/users/123').reply(200, {
    success: true,
    data: {
      id: 123,
      name: 'foo bar',
    },
  });

  const user = await api.users.get(123);

  expect(user.id).toEqual(123);
  expect(user.name).toEqual('foo bar');
  expect(user.constructor.name).toEqual('User');
  expect(user.constructor.resourceName).toEqual('users');
});

test('get should throw an exception when an api call is unsuccessful', async () => {
  nock('https://example.com').get('/v1/users/123').reply(404, {
    success: false,
    error: {
      type: 'ModelNotFoundException',
      message: 'User with id 123 not found',
    },
  });

  expect.assertions(2);

  try {
    await api.users.get(123);
  } catch (error) {
    expect(error.type).toEqual('ModelNotFoundException');
    expect(error.message).toEqual('User with id 123 not found');
  }
});

test('select returns a new instance', () => {
  const user = api.users.select('me');

  expect(user.id).toEqual('me');
  expect(user.constructor.name).toEqual('User');
  expect(user.constructor.resourceName).toEqual('users');
});


test('empty select returns a new instance', () => {
  const user = api.users.select();

  expect(user.toObject()).toEqual({});
  expect(user.constructor.name).toEqual('User');
  expect(user.constructor.resourceName).toEqual('users');
});
