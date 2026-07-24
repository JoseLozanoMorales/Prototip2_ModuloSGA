function agregarListaItemsAFormData(formdata) {
    try {
        formdata.append("lista_items1", JSON.stringify(lista_items1));
        console.log(lista_items1)
    } catch (err) {
        console.log(err.message);
    }
    try {
        formdata.append("lista_items2", JSON.stringify(lista_items2));
    } catch (err) {
        console.log(err.message);
    }
    try {
        formdata.append("lista_items3", JSON.stringify(lista_items3));
    } catch (err) {
        console.log(err.message);
    }
    try {
        formdata.append("lista_items4", JSON.stringify(lista_items4));
    } catch (err) {
        console.log(err.message);
    }
    try {
        formdata.append("lista_items5", JSON.stringify(lista_items5));
    } catch (err) {
        console.log(err.message);
    }
    try {
        formdata.append("lista_items6", JSON.stringify(lista_items6));
    } catch (err) {
        console.log(err.message);
    }
    try {
        formdata.append("lista_items7", JSON.stringify(lista_items7));
    } catch (err) {
        console.log(err.message);
    }
    try {
        formdata.append("lista_items8", JSON.stringify(lista_items8));
    } catch (err) {
        console.log(err.message);
    }
}