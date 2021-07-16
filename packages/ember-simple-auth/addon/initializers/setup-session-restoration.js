import { getOwner } from '@ember/application';

export default function setupSessionRestoration(registry) {
  const Router = registry.resolveRegistration ? registry.resolveRegistration('router:main') : registry.resolve('router:main');

  Router.reopen({
    setupRouter() {
      const superValue = this._super(...arguments);
      const ApplicationRoute =
        getOwner(this).factoryFor('route:application').class;

      ApplicationRoute.reopen({
        init() {
          this._super(...arguments);

          const originalBeforeModel = this.beforeModel;
          this.beforeModel = function() {
            if (!this.__usesApplicationRouteMixn__) {
              const sessionService = getOwner(this).lookup('service:session');
              sessionService._setupHandlers();
            }

            const session = getOwner(this).lookup('session:main');
            return session.restore().then(
              () => originalBeforeModel.apply(this, arguments),
              () => originalBeforeModel.apply(this, arguments)
            );
          };
        },
      });

      return superValue;
    },
  });
}
