function procesarUrl(urlString) {
    const urlObj = new URL(urlString, window.location.origin);

    return {
        // .pathname te da la parte: "/tu/path"
        ruta: urlObj.pathname,

        params: Object.fromEntries(urlObj.searchParams.entries())
    };
}