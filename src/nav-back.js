(function () {
    'use strict';

    function isSameOriginReferrer() {
        try {
            if (!document.referrer) return false;
            const ref = new URL(document.referrer);
            return ref.origin === window.location.origin;
        } catch {
            return false;
        }
    }

    function navigateBackOrFallback(fallbackUrl) {
        const fallback = fallbackUrl || '/';

        if (isSameOriginReferrer()) {
            window.history.back();
            return;
        }

        window.location.href = fallback;
    }

    document.addEventListener('DOMContentLoaded', function () {
        const links = document.querySelectorAll('a.js-back-link');
        links.forEach(function (link) {
            link.addEventListener('click', function (event) {
                event.preventDefault();
                navigateBackOrFallback(link.getAttribute('data-fallback') || link.getAttribute('href') || '/');
            });
        });
    });
})();
