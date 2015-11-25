/**
 * @module hateoas
 *
 * An AngularJS module for working with HATEOAS.
 *
 */
angular.module('hateoas', ['ngResource'])

  .provider('HateoasInterface', function () {

    // global Hateoas settings
    var globalHttpMethods,
      linksKey = 'links';

    return {

      setLinksKey: function (newLinksKey) {
        linksKey = newLinksKey || linksKey;
      },

      getLinksKey: function () {
        return linksKey;
      },

      setHttpMethods: function (httpMethods) {
        globalHttpMethods = angular.copy(httpMethods);
      },

      $get: ['$injector', '$q', '$log', function ($injector, $q, $log) {

        var arrayToObject = function (object) {
          var obj = object;

          Object.keys(object).forEach(function (prop) {

            if (angular.isArray(object[prop])) {
              object[prop].forEach(function (item, key) {
                obj[prop][key] = item['href'] || item;
              });
            }
            else if (angular.isObject(object[prop])) {
              obj[prop] = object[prop]['href'];
            }

          });

          return obj;
        };

        var resource = function (linkName, bindings, httpMethods) {

          if (linkName in this[linksKey]) {

            var links = this[linksKey][linkName];

            if (/(.png)/g.test(this[linksKey])) {
              var defer = $q.defert();
              $q.resolve(this[linksKey]);
              return defer.promise;
            }

            if (!angular.isArray(links)) {
              links = [links];
            }

            var injectedResource = $injector.get('$resource');
            var promiseAll = $q.all(links.map(function (link) {

              // special treatment for images
              if(link.type && link.type.indexOf('image') >= 0) {
                link.get = function() {
                  return this;
                }
                return link;
              }

              return injectedResource(link.href, bindings, httpMethods || globalHttpMethods);

            })).then(function (resources) {

              if (resources.length > 1) {
                return resources.map(function (resource) {
                  return resource.get();
                });
              }
              else if (resources.length === 1) {
                return resources.pop().get();
              }

            });

            return promiseAll;

          } else {
            throw 'Link "' + linkName + '" is not present in object.';
          }
        };

        var HateoasInterface = function (data) {

          // if links are present, consume object and convert links
          if (data[linksKey]) {
            var links = {};
            //links[linksKey] = arrayToObject(data[linksKey]);
            data = angular.extend(this, data, links, {resource: resource});
          }

          // recursively consume all contained arrays or objects with links
          angular.forEach(data, function (value, key) {
            if (key !== linksKey && angular.isObject(value) && (angular.isArray(value) || value[linksKey])) {
              data[key] = new HateoasInterface(value);
            }
          });

          return data;

        };

        return HateoasInterface;

      }]

    };

  })

  .provider('HateoasInterceptor', ['$httpProvider', function ($httpProvider) {

    return {

      transformAllResponses: function () {
        $httpProvider.interceptors.push('HateoasInterceptor');
      },

      $get: ['HateoasInterface', '$q', function (HateoasInterface, $q) {

        return {
          response: function (response) {

            if (response && angular.isObject(response.data)) {
              response.data = new HateoasInterface(response.data);
            }

            return response || $q.when(response);

          }
        };
      }]

    };

  }]);
