window.dataLayer = window.dataLayer || [];
function gtag() { dataLayer.push(arguments); }

window.addEventListener('load', function () {
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=G-5KHK1H2944';
    document.head.appendChild(script);

    const host = location.hostname;
    const isLocal = host === 'localhost' || host.startsWith('127.');
    const cookieDom = isLocal ? 'none' : 'uteq.edu.ec';

    gtag('js', new Date());
    gtag('config', 'G-5KHK1H2944', {
        cookie_domain: cookieDom,
        cookie_flags: 'SameSite=None;Secure'
    });
});