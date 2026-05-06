/**
 * Drop-in replacement for mage/apply/main.
 *
 * Identical logic to the Magento core module except non-critical component
 * callbacks are scheduled with requestIdleCallback(fn, { timeout: 2000 }).
 * This spreads expensive component initialization across browser idle periods
 * instead of queuing all callbacks back-to-back.
 *
 * Falls back to setTimeout(fn, 0) on browsers without requestIdleCallback.
 *
 * Escape hatch: set window.gphpDeferMageApply = false before RequireJS loads
 * (e.g. inline in <head>) to bypass this module and load the original instead.
 */
define([
    'underscore',
    'jquery',
    'mage/apply/scripts'
], function (_, $, processScripts) {
    'use strict';

    if (typeof window !== 'undefined' && window.gphpDeferMageApply === false) {
        // Bail out — caller should have mapped the original instead, but guard anyway.
        return null;
    }

    var dataAttr = 'data-mage-init',
        nodeSelector = '[' + dataAttr + ']';

    var criticalComponents = {
        'Magento_Ui/js/core/app': true,
        'Magento_Swatches/js/swatch-renderer': true,
        configurable: true,
        dropdownDialog: true
    };

    /**
     * Schedule a component callback.
     *
     * Keep UI bootstrap widgets on Magento's original macrotask timing. Deferring
     * them to idle can race Knockout scope/template resolution and briefly expose
     * raw dropdown DOM before dropdownDialog upgrades it.
     */
    function schedule(fn, component) {
        if (!_.isFunction(fn)) {
            return;
        }

        if (criticalComponents[component]) {
            setTimeout(fn, 0);
            return;
        }

        if (typeof window.requestIdleCallback === 'function') {
            window.requestIdleCallback(fn, { timeout: 2000 });
        } else {
            setTimeout(fn, 0);
        }
    }

    /**
     * Initializes a single component on an element.
     * Uses idle scheduling for non-critical components to avoid TBT spikes.
     */
    function init(el, config, component) {
        require([component], function (fn) {
            var $el;

            if (typeof fn === 'object' && fn !== null && fn[component]) {
                fn = fn[component].bind(fn);
            }

            if (_.isFunction(fn)) {
                fn = fn.bind(null, config, el);
            } else {
                $el = $(el);

                if ($el[component]) {
                    fn = $el[component].bind($el, config); // eslint-disable-line jquery-no-bind-unbind
                }
            }

            schedule(fn, component);
        }, function (error) {
            if ('console' in window && typeof window.console.error === 'function') {
                console.error(error);
            }

            return true;
        });
    }

    /**
     * Parses element's data-mage-init attribute and removes it.
     */
    function getData(el) {
        var data = el.getAttribute(dataAttr);

        el.removeAttribute(dataAttr);

        return {
            el: el,
            data: JSON.parse(data)
        };
    }

    return {
        /**
         * Initializes components assigned to HTML elements via [data-mage-init]
         * and <script type="text/x-magento-init"> blocks.
         */
        apply: function (context) {
            var virtuals = processScripts(!context ? document : context),
                nodes = document.querySelectorAll(nodeSelector);

            _.toArray(nodes)
                .map(getData)
                .concat(virtuals)
                .forEach(function (itemContainer) {
                    var element = itemContainer.el;

                    _.each(itemContainer.data, function (obj, key) {
                        if (obj.mixins) {
                            require(obj.mixins, function () { //eslint-disable-line max-nested-callbacks
                                var i, len;

                                for (i = 0, len = arguments.length; i < len; i++) {
                                    $.extend(
                                        true,
                                        itemContainer.data[key],
                                        arguments[i](itemContainer.data[key], element)
                                    );
                                }

                                delete obj.mixins;
                                init.call(null, element, obj, key);
                            });
                        } else {
                            init.call(null, element, obj, key);
                        }
                    });
                });
        },

        applyFor: init
    };
});
