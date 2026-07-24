function getScreenSize() {
    let width = screen.width ? screen.width : unknown;
    let height = screen.height ? screen.height : unknown;
    return width + " x " + height;
}

function getBrowserInfo() {
    let userAgent = navigator.userAgent;
    let temp;
    let browser = navigator.appName;
    let version = '' + parseFloat(navigator.appVersion);
    let matchArray = [
        {pattern: /(opera|opr|opios)[\/\s](\d+)/i},                            // Opera
        {pattern: /(msie|trident) (\d+)/i},                                    // Internet Explorer
        {pattern: /(chrome|crios)[\/\s](\d+)/i},                               // Chrome
        {pattern: /(version\/)(\d+) (.*)safari/i},                             // Safari
        {pattern: /(firefox|fxios)[\/\s](\d+)/i},                              // Firefox
        {pattern: /rv:(\d+).*\bgecko\b/i},                                     // IE11
    ];

    for (var i = 0; i < matchArray.length; i++) {
        let match = userAgent.match(matchArray[i].pattern);
        if (match) {
            browser = match[1];
            version = match[2];
            break;
        }
    }
    return { name: browser, version: version };
}

function getOSInfo() {
    let userAgent = navigator.userAgent;
    let platform = navigator.platform;
    let macosPlatforms = ['Macintosh', 'MacIntel', 'MacPPC', 'Mac68K'];
    let windowsPlatforms = ['Win32', 'Win64', 'Windows', 'WinCE'];
    let iosPlatforms = ['iPhone', 'iPad', 'iPod'];
    let os = 'unknown';
    let version = 'unknown';

    if (macosPlatforms.indexOf(platform) !== -1) {
        os = 'Mac OS';
        version = /Mac OS X (\d+[\._\d]+)/.exec(userAgent)[1].replace(/_/g, '.');
    } else if (iosPlatforms.indexOf(platform) !== -1) {
        os = 'iOS';
        version = /OS (\d+)_(\d+)_?(\d+)?/.exec(navigator.appVersion)[1] + '.' + RegExp.$2 + '.' + (RegExp.$3 | 0);
    } else if (windowsPlatforms.indexOf(platform) !== -1) {
        os = 'Windows';
        version = /Windows NT (\d+.\d+)/.exec(userAgent)[1];
    } else if (/Android/.test(userAgent)) {
        os = 'Android';
        version = /Android (\d+(\.\d+)?)/.exec(userAgent)[1];
    } else if (/Linux/.test(platform)) {
        os = 'Linux';
    }

    return { name: os, version: version };
}

function isMobile() {
    return /Mobile|mini|Fennec|Android|iP(ad|od|hone)/.test(navigator.userAgent);
}

async function obtenerDireccionIP() {
  try {
    const response = await fetch('https://api.ipify.org?format=json');

    // Check for successful response status code
    if (!response.ok) {
      throw new Error(`API request failed with status: ${response.status}`);
    }

    const data = await response.json();
    return data.ip;
  } catch (error) {
    console.error('Error al obtener la dirección IP:', error);
    return 'Error'; // More informative default value
  }
}

// async function obtenerDireccionIP() {
//   const timeout = 5000; // Tiempo máximo de espera para la solicitud (en milisegundos)
//   const apiURL = 'https://api.ipify.org?format=json';
//
//   // Función para crear un timeout promise
//   const fetchWithTimeout = (url, options, timeout) => {
//     const controller = new AbortController();
//     const signal = controller.signal;
//     options = { ...options, signal };
//
//     return new Promise((resolve, reject) => {
//       const timer = setTimeout(() => {
//         controller.abort();
//         reject(new Error('La solicitud se ha abortado debido a un tiempo de espera.'));
//       }, timeout);
//
//       fetch(url, options)
//         .then(response => {
//           clearTimeout(timer);
//           if (!response.ok) {
//             reject(new Error(`API request failed with status: ${response.status}`));
//           }
//           resolve(response.json());
//         })
//         .catch(err => {
//           clearTimeout(timer);
//           reject(err);
//         });
//     });
//   };
//
//   try {
//     const data = await fetchWithTimeout(apiURL, {}, timeout);
//     return data.ip;
//   } catch (error) {
//     console.error('Error al obtener la dirección IP:', error.message || error);
//     return 'Error al obtener IP';
//   }
// }

async function getClientInfo() {
    let unknown = '-';
    let screenSize = getScreenSize(); //síncrona
    let browserInfo = getBrowserInfo(); //síncrona
    let osInfo = getOSInfo(); //síncrona
    let mobile = isMobile(); //síncrona
    let cookieEnabled = navigator.cookieEnabled ? true : false;
    // const ip = await obtenerDireccionIP(); //Asíncrona
    const ip = ''; //Asíncrona
    return {
        screenSize: screenSize,
        browser: browserInfo.name,
        browserVersion: browserInfo.version,
        os: osInfo.name,
        osVersion: osInfo.version,
        mobile: mobile,
        cookieEnabled: cookieEnabled,
        ip: ip
    };
}
