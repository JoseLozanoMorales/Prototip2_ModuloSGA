$(function () {

    const isMobileOrTablet = () => /Android|iPhone|iPad|iPod|Mobile|Tablet|Windows Phone/i.test(navigator.userAgent);

    function isCompatible() {
        const ua = navigator.userAgent;
        const isChromium = /Chrome|Edg|Brave|OPR|Opera|Samsung/i.test(ua);
        const isFirefox = /Firefox/i.test(ua);
        const isPureSafari = /Safari/i.test(ua) && !/Chrome|Edg|Brave|OPR|Opera|Samsung/i.test(ua);
        return isChromium && !isFirefox && !isPureSafari;
    }

    const isInstalled = () =>
        window.matchMedia('(display-mode: standalone)').matches ||
        navigator.standalone === true;   // iOS

    let deferredPrompt;

    window.addEventListener('beforeinstallprompt', e => {
        console.log(isMobileOrTablet(), isCompatible(), isInstalled())
        if (!isMobileOrTablet() || !isCompatible() || isInstalled()) return;

        e.preventDefault();
        deferredPrompt = e;

        const btn = document.getElementById('install-btn');
        btn.style.display = 'inline-block';

        btn.onclick = async () => {
            btn.style.display = 'none';
            deferredPrompt.prompt();
            const {outcome} = await deferredPrompt.userChoice;
            console.log('Instalación:', outcome);  // accepted / dismissed
            deferredPrompt = null;
        };
    });

    window.addEventListener('appinstalled', () =>
        document.getElementById('install-btn')?.style.setProperty('display', 'none')
    );

});