__[Ember Simple Auth API docs](http://ember-simple-auth.com/api/)__

![CI](https://github.com/simplabs/ember-simple-auth/workflows/CI/badge.svg)

__[![Discord](https://img.shields.io/discord/480462759797063690.svg?logo=discord)](https://discord.gg/zT3asNS)__

Ember Simple Auth __supports all Ember.js versions starting with 3.0.__
Node __12 is required__  

#  Ember Simple Auth

![Logo](http://ember-simple-auth.com/images/logo.png)

Ember Simple Auth is a __lightweight library for implementing authentication/
authorization with [Ember.js](http://emberjs.com) applications__. It has
minimal requirements with respect to application structure, routes etc. With
its pluggable strategies it __can support all kinds of authentication and
authorization mechanisms__.

# Table of Contents

**Basic Information**

* [What does it do?](#what-does-it-do)
* [How does it work?](#how-does-it-work)
* [Example App](#example-app)

**Usage**

* [Installation](#installation)
* [Walkthrough](#walkthrough)

**Core Feature Guides**

* [The Session Service](#the-session-service)
* [Authenticators](#authenticators)
  * [Customizing an Authenticator](#customizing-an-authenticator)
  * [Implementing a custom Authenticator](#implementing-a-custom-authenticator)
* [Session Stores](#session-stores)
  * [Store Types](#store-types)
  * [Implementing a Custom Store](#implementing-a-custom-store)
* [FastBoot](#fastboot)
* [Engines](#engines)
* [Testing](#testing)

**Other Guides**

* [Managing a current User](guides/managing-current-user.md)
* [GitHub authorization with torii](guides/auth-torii-with-github.md)

**Other Resources**

* [Upgrading from Pre-1.0 versions](https://simplabs.com/blog/2015/11/27/updating-to-ember-simple-auth-1.0.html)
* [API Documentation](http://ember-simple-auth.com/api/)

## What does it do?

* it __maintains a client side session__ and synchronizes its state across
  multiple tabs/windows of the application
* it __authenticates the session__ against the application's own server,
  external providers like Facebook etc.
* it is __easily customizable and extensible__

## How does it work?

Ember Simple Auth consists of __3 main building blocks__ - the session, a
session store and authenticators.

The __session service is the main interface to the library__. It provides
__methods for authenticating and invalidating the session__ as well as for
setting and reading session data.

The __session store persists the session state__ so that it survives a page
reload. It also synchronizes the session state across multiple tabs or windows
of the application so that e.g. a logout in one tab or window also results in a
logout in all other tabs or windows of the application.

__Authenticators authenticate the session__. An application can leverage
multiple authenticators to support multiple ways of authentication such as
sending credentials to the application's own backend server, Facebook, github
etc.

## Example App

__Ember Simple Auth comes with a
[test app](packages/test-app/)
that implements a complete auth solution__ including authentication against
the application's own server as well as Facebook, authorization of Ember Data
requests and error handling. __Check out that test app for reference.__ To
start it, run

```
git clone https://github.com/simplabs/ember-simple-auth.git
cd ember-simple-auth/packages/test-app
yarn install && ember serve
```

and go to [http://localhost:4200](http://localhost:4200).

## Installation

Installing the library is as easy as:

```bash
ember install ember-simple-auth
```

### Upgrading from a pre-3.0 release?
The 3.0 release of ember-simple-auth removes previously deprecated code,
introducing some breaking changes, but thankfully there is an
[upgrade guide](guides/upgrade-to-v3.md).

## Walkthrough

Once the library is installed, __the session service can be injected wherever
needed in the application__. In order to display login/logout buttons depending
on the current session state, inject the service into the respective controller
or component and __query its
[`isAuthenticated` property](http://ember-simple-auth.com/api/classes/SessionService.html#property_isAuthenticated)
in the template__:

```js
// app/controllers/application.js
import Controller from '@ember/controller';
import { inject as service } from '@ember/service';

export default class ApplicationController extends Controller {
  @service session;

  …
}
```

```handlebars
{{!-- app/templates/application.hbs --}}
<div class="menu">
  …
  {{#if this.session.isAuthenticated}}
    <a {{on "click" this.invalidateSession}}>Logout</a>
  {{else}}
    {{#link-to 'login'}}Login{{/link-to}}
  {{/if}}
</div>
<div class="main">
  {{outlet}}
</div>
```

In the `invalidateSession` action __call the
[session service's `invalidate` method](http://ember-simple-auth.com/api/classes/SessionService.html#method_invalidate)
to invalidate the session__ and log the user out:

```js
// app/controllers/application.js
import Controller from '@ember/controller';
import { inject as service } from '@ember/service';
import { action } from "@ember/object";

export default class ApplicationController extends Controller {
  @service session;

  …

  @action
  invalidateSession() {
    this.session.invalidate();
  }
}
```

For authenticating the session, __the session service provides the
[`authenticate` method](http://ember-simple-auth.com/api/classes/SessionService.html#method_authenticate)__
that takes the name of the authenticator to use as well as other arguments
depending on specific authenticator used. __To define an authenticator, add a
new file in `app/authenticators`__ and extend one of the authenticators the
library comes with, e.g.:

```js
// app/authenticators/oauth2.js
import OAuth2PasswordGrant from 'ember-simple-auth/authenticators/oauth2-password-grant';

export default class OAuth2Authenticator extends OAuth2PasswordGrant {}
```

With that authenticator and a login form like

```handlebars
{{!-- app/templates/login.hbs --}}
<form {{on "submit" this.authenticate}}>
  <label for="identification">Login</label>
  <input id='identification' placeholder="Enter Login" value={{this.identification}} {{on "change" this.updateIdentification}}>
  <label for="password">Password</label>
  <input id='password' placeholder="Enter Password" value={{this.password}} {{on "change" this.updatePassword}}>
  <button type="submit">Login</button>
  {{#if this.errorMessage}}
    <p>{{this.errorMessage}}</p>
  {{/if}}
</form>
```

the __session can be authenticated with the
[session service's `authenticate` method](http://ember-simple-auth.com/api/classes/SessionService.html#method_authenticate)__:

```js
// app/controllers/login.js
import Controller from '@ember/controller';
import { inject as service } from '@ember/service';
import { action } from "@ember/object";
import { tracked } from "@glimmer/tracking";

export default class LoginController extends Controller {
  @tracked errorMessage;
  @service session;

  @action
  async authenticate(e) {
    e.preventDefault();
    let { identification, password } = this;
    try {
      await this.session.authenticate('authenticator:oauth2', identification, password);
    } catch(error) {
      this.errorMessage = error.error || error;
    }

    if (this.session.isAuthenticated) {
      // What to do with all this success?
    }
  }

  @action
  updateIdentification(e) {
    this.identification = e.target.value;
  }

  @action
  updatePassword(e) {
    this.password = e.target.value;
  }
}
```

__To make a route in the application accessible only when the session is
authenticated__, call the session service's
[`requireAuthentication`](http://ember-simple-auth.com/api/classes/SessionService.html#method_requireAuthentication)
method in the respective route's  `beforeModel` method:

```js
// app/routes/authenticated.js
import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';

export default class AuthenticatedRoute extends Route {
  @service session;

  beforeModel(transition) {
    this.session.requireAuthentication(transition, 'login');
  }
}
```

This will make the route (and all of its subroutes) transition to the `login`
route if the session is not authenticated. Add the `login` route in the router
like this:

```js
// app/router.js
Router.map(function() {
  this.route('login');
});
```

It is recommended to nest all of an application's routes that require the
session to be authenticated under a common parent route:

```js
// app/router.js
Router.map(function() {
  this.route('login');
  this.route('authenticated', { path: '' }, function() {
    // all routes that require the session to be authenticated
  });
});
```

To prevent a route from being accessed when the session is authenticated (which
makes sense for login and registration routes for example), call the session
service's
[`prohibitAuthentication`](http://ember-simple-auth.com/api/classes/SessionService.html#method_prohibitAuthentication)
method in the respective route's `beforeModel` method:

```js
// app/routes/login.js
import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';

export default class LoginRoute extends Route {
  @service session;

  beforeModel(transition) {
    this.get('session').prohibitAuthentication('index');
  }
}
```

__The session service also provides the
[`handleAuthentication`](http://ember-simple-auth.com/api/classes/SessionService.html#method_handleAuthentication)
and
[`handleInvalidation`](http://ember-simple-auth.com/api/classes/SessionService.html#method_handleInvalidation)
methods__ for handling authentication and invalidation of the session (which
not only happens when the user submits the login form or clicks the logout
button but also when the session is authenticated or invalidated in another tab
or window of the application). The `handleAuthentication` method will
transition to a configurable route while the `handleInvalidation` method will
reload the page to clear all potentially sensitive data from memory. In order
to customize those behaviours, these methods can be overridden when the
application defines its own session service that extends the one provided by
Ember Simple Auth.

You can create your own session service that extends SimpleAuthSessionService in order to customize the `handleAuthentication` method to
redirect to a default route or possibly load the current user.
```
import SimpleAuthSessionService from 'ember-simple-auth/services/session';
import { inject as service } from '@ember/service';

export default class SessionService extends SimpleAuthSessionService {
    /**
     * Inject the router service
     *
     * @var {Service}
     */
    @service router;

    /**
     * Inject the current user service
     *
     * @var {Service}
     */
    @service currentUser;

    /**
     * Overwrite the handle authentication method
     *
     * @var {Service}
     */
    handleAuthentication() {
        this.router.transitionTo('dashboard.boards');
        this.loadCurrentUser();
    }

    /**
     * Loads the current authenticated user
     *
     * @void
     */
    async loadCurrentUser() {
        try {
            const user = await this.currentUser.load();
            return user;
        } catch (err) {
            await this.session.invalidate();
        }
    }
}

```

To add authorization information to requests, you can use the session service
to check if the session is authenticated and access
authentication/authorization data, e.g. a token:

```js
// app/adapters/application.js
import JSONAPIAdapter from '@ember-data/adapter/json-api';
import { computed } from '@ember/object';
import { inject as service } from '@ember/service';

export default class ApplicationAdapter extends JSONAPIAdapter {
  @service session;

  @computed('session.{data.authenticated.access_token,isAuthenticated}')
  get headers() {
    let headers = {};
    if (this.session.isAuthenticated) {
      // OAuth 2
      headers['Authorization'] = `Bearer ${this.session.data.authenticated.access_token}`;
    }

    return headers;
  }
}
```

## The Session Service

The session service is the main interface to the library. It defines the
`authenticate`, `invalidate` and `authorize` methods as well as the session
events as shown above.

It also provides the
__[`isAuthenticated`](http://ember-simple-auth.com/api/classes/SessionService.html#property_isAuthenticated)
as well as the
[`data`]((http://ember-simple-auth.com/api/classes/SessionService.html#property_data))
properties. The latter can be used to get and set the session data__. While the
special `authenticated` section in the session data contains the data that was
acquired by the authenticator when it authenticated the session and is
read-only, all other session data can be written and will also remain in the
session after it is invalidated. It can be used to store all kinds of client
side data that needs to be persisted and synchronized across tabs and windows,
e.g.:

```js
this.session.set('data.locale', 'de');
```

## Authenticators

__Authenticators implement the concrete steps necessary to authenticate the
session.__ An application can leverage several authenticators for different
kinds of authentication mechanisms (e.g. the application's own backend server,
external authentication providers like Facebook etc.) while the session is only
ever authenticated with one authenticator at a time. The authenticator to use
is chosen when authentication is triggered via the name it is registered with
in the Ember container:

```js
this.session.authenticate('authenticator:some');
```

Ember Simple Auth comes with 4 authenticators:

* [`OAuth2PasswordGrantAuthenticator`](http://ember-simple-auth.com/api/classes/OAuth2PasswordGrantAuthenticator.html): an OAuth 2.0 authenticator that implements the _"Resource Owner Password Credentials Grant Type"_
* [`OAuth2ImplicitGrantAuthenticator`](http://ember-simple-auth.com/api/classes/OAuth2ImplicitGrantAuthenticator.html): an OAuth 2.0 authenticator that implements the _"Implicit Grant Type"_
* [`DeviseAuthenticator`](http://ember-simple-auth.com/api/classes/DeviseAuthenticator.html): an authenticator compatible with the popular Ruby on Rails authentication plugin [devise](https://github.com/plataformatec/devise)
* [`ToriiAuthenticator`](http://ember-simple-auth.com/api/classes/ToriiAuthenticator.html): an authenticator that wraps the [torii library](https://github.com/Vestorly/torii)

To use any of these authenticators in an application, define a new
authenticator in `app/authenticators`, extend if from the Ember Simple Auth
authenticator

```js
// app/authenticators/oauth2.js
import OAuth2PasswordGrantAuthenticator from 'ember-simple-auth/authenticators/oauth2-password-grant';

export default class OAuth2Authenticator extends OAuth2PasswordGrantAuthenticator {}
```

and invoke the session service's `authenticate` method with the respective
name, specifying more arguments as needed by the authenticator:

```js
this.session.authenticate('authenticator:some', data);
```

### Customizing an Authenticator

Authenticators are easily customized by setting the respective properties,
e.g.:

```js
// app/authenticators/oauth2.js
import OAuth2PasswordGrantAuthenticator from 'ember-simple-auth/authenticators/oauth2-password-grant';

export default class OAuth2Authenticator extends OAuth2PasswordGrantAuthenticator {
  serverTokenEndpoint = '/custom/endpoint';
}
```

### Implementing a custom Authenticator

Besides extending one of the predefined authenticators, an application can also
implement fully custom authenticators. In order to do that, extend the
[abstract base authenticator](http://ember-simple-auth.com/api/classes/BaseAuthenticator.html)
that Ember Simple Auth comes with and override the
[`authenticate`](http://ember-simple-auth.com/api/classes/BaseAuthenticator.html#method_authenticate),
[`restore`](http://ember-simple-auth.com/api/classes/BaseAuthenticator.html#method_restore)
and (optionally)
[`invalidate`](http://ember-simple-auth.com/api/classes/BaseAuthenticator.html#method_invalidate)
methods:

```js
// app/authenticators/custom.js
import Base from 'ember-simple-auth/authenticators/base';

export default class CustomAuthenticator extends Base {
  restore(data) {
    …
  }

  authenticate(options) {
    …
  }

  invalidate(data) {
    …
  }
}
```

## Session Stores

Ember Simple Auth __persists the session state via a session store so it
survives page reloads__. There is only one store per application that can be
defined in `app/session-stores/application.js`:

```js
// app/session-stores/application.js
import Cookie from 'ember-simple-auth/session-stores/cookie';

export default class ApplicationSessionStore extends Cookie {}
```

If the application does not define a session store, the adaptive store which
uses `localStorage` if that is available or a cookie if it is not, will be used
by default. To customize the adaptive store, define a custom store in
`app/session-stores/application.js` that extends it and overrides the
properties to customize.

### Store Types

Ember Simple Auth comes with 4 stores:

#### Adaptive Store

[The adaptive store](http://ember-simple-auth.com/api/classes/AdaptiveStore.html)
stores its data in the browser's `localStorage` if that is available or in a
cookie if it is not; __this is the default store__.

#### `localStorage` Store

[The `localStorage` store](http://ember-simple-auth.com/api/classes/LocalStorageStore.html)
stores its data in the browser's `localStorage`. This is used by the adaptive
store if `localStorage` is available.

#### Cookie Store

[The Cookie store](http://ember-simple-auth.com/api/classes/CookieStore.html)
stores its data in a cookie. This is used by the adaptive store if
`localStorage` is not available. __This store must be used when the
application uses
[FastBoot](https://github.com/ember-fastboot/ember-cli-fastboot).__

#### `sessionStorage` Store

[The `sessionStorage` store](http://ember-simple-auth.com/api/classes/SessionStorageStore.html)
stores its data in the browser's `sessionStorage`. See [the Web Storage docs](
https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API) for details on
`sessionStorage` and `localStorage`. [caniuse](http://caniuse.com/#feat=namevalue-storage)
has up-to-date information on browser support of `sessionStorage` and `localStorage`.

#### Ephemeral Store

[The ephemeral store](http://ember-simple-auth.com/api/classes/EphemeralStore.html)
stores its data in memory and thus __is not actually persistent. This store is
mainly useful for testing.__ Also the ephemeral store cannot keep multiple tabs
or windows in sync as tabs/windows cannot share memory.

### Customizing the Store

The session store is easily customized by setting the respective properties,
e.g.:

```js
// app/session-stores/application.js
import AdaptiveStore from 'ember-simple-auth/session-stores/adaptive';

export default class ApplicationSessionStore extends AdaptiveStore {
  cookieName = 'my-apps-session-cookie';
}
```

### Implementing a custom Store

Besides using one of the predefined session stores, an application can also
implement fully custom stores. In order to do that, extend the
[abstract base session store](http://ember-simple-auth.com/api/classes/BaseStore.html)
that Ember Simple Auth comes with and implement the
[`persist`](http://ember-simple-auth.com/api/classes/BaseStore.html#method_persist),
[`restore`](http://ember-simple-auth.com/api/classes/BaseStore.html#method_restore)
and
[`clear`](http://ember-simple-auth.com/api/classes/BaseStore.html#method_clear)
methods:

```js
// app/session-stores/application.js
import Base from 'ember-simple-auth/session-stores/base';

export default class ApplicationSessionStore extends Base {
  persist() {
    …
  }

  restore() {
    …
  }
}
```

## FastBoot

Ember Simple Auth works with FastBoot out of the box as long as the Cookie
session store is being used. In order to enable the cookie store, define it as
the application store:

```js
// app/session-stores/application.js
import CookieStore from 'ember-simple-auth/session-stores/cookie';

export default class ApplicationSessionStore extends CookieStore {}
```

If you are using the
[`OAuth2PasswordGrantAuthenticator`](http://ember-simple-auth.com/api/classes/OAuth2PasswordGrantAuthenticator.html),
or
[`DeviseAuthenticator`](http://ember-simple-auth.com/api/classes/DeviseAuthenticator.html),
you must add `node-fetch` to your list of FastBoot whitelisted dependencies
in `package.json`:

```json
{
  "fastbootDependencies": [
    "node-fetch"
  ]
}
```

## Engines

Ember Simple Auth works with engines out of the box. The host app and any
engine(s) share the same `session` service so they can synchronize the
authentication status:

```js
// my-engine/addon/routes/index.js
import Application from '@ember/application';
import loadInitializers from 'ember-load-initializers';

class App extends Application {
  …

  engines = {
    'my-engine': {
      dependencies: {
        services: [
          'session'
        ]
      }
    }
  }
});

…

export default App;

```

The session can then be authenticated or invalidated from the host app or any
of the engines and the state will be synchronized via the service.

One thing to be aware of is that if the authentication route is outside of the
engine (e.g. in the host app), it is necessary to use the special
`transitionToExternal` method in the engine to transition to it. That can be
done by passing a callback instead of a route name to the session service's
`requireAuthentication` method in that case:

```js
// my-engine/addon/routes/index.js
import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';

export default class IndexRoute extends Route {
  @service session;

  beforeModel(transition) {
    this.get('session').requireAuthentication(transition, () => this.transitionToExternal('login'));
  },
}
```

## Testing

Ember Simple Auth comes with a __set of test helpers that can be used in acceptance tests__.

Our helpers use the [more modern testing syntax](https://dockyard.com/blog/2018/01/11/modern-ember-testing)
and therefore require `ember-cli-qunit` [4.2.0 or greater](https://github.com/ember-cli/ember-cli-qunit/blob/master/CHANGELOG.md#v420-2017-12-17)
or `ember-qunit` 3.2.0 or greater.

We provide the following helpers:
* `currentSession()` returns the current session.
* `authenticateSession(sessionData)` authenticates the session asynchronously;
  the optional `sessionData` argument can be used to mock the response of an
  authentication request, to provide a specific authorization token or user
  data.
* `invalidateSession()` invalidates the session asynchronously.

Which can be used as shown in the following example:

```js
import { module, test } from 'qunit';
import { visit, currentURL } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import { currentSession, authenticateSession, invalidateSession } from 'ember-simple-auth/test-support';

module('Acceptance | app test', function(hooks) {
  setupApplicationTest(hooks);

  test('/login redirects to index if user is alread logged in', async function(assert) {
    await authenticateSession({
      authToken: '12345',
      otherData: 'some-data'
    });
    await visit('/login');

    assert.equal(currentURL(), '/');

    let sessionData = currentSession().get('data.authenticated');
    assert.equal(sessionData.authToken, '12345');
    assert.equal(sessionData.otherData, 'some-data');
  });

  test('/protected redirects to /login if user is not logged in', async function(assert) {
    await invalidateSession();

    await visit('/protected');

    assert.equal(currentURL(), '/login');
  });
});
```

If you're an `ember-mocha` user, we can recommend to check out this
[example from the test suite of ember-simple-auth itself](https://github.com/simplabs/ember-simple-auth/blob/master/tests/acceptance/authentication-test.js).

## Other guides

* [Managing current User](guides/managing-current-user.md)

## License

Ember Simple Auth is developed by and &copy;
[simplabs GmbH](http://simplabs.com) and contributors. It is
released under the
[MIT License](LICENSE).

Ember Simple Auth is not an official part of [Ember.js](http://emberjs.com) and
is not maintained by the Ember.js Core Team.
