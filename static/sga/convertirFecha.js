function convertirFecha_DateTime(fechaString) {
    let listafecha = [];
    let listahora = [];
    let fecha;
    let listafechahora = fechaString.split("T");
    if (listafechahora.length > 1){
        listahora = listafechahora[1].split(":");
    }
    listafecha = listafechahora[0].split("-");
    if (listahora.length > 0){
        fecha = new Date(parseInt(listafecha[0]), parseInt(listafecha[1])-1, parseInt(listafecha[2]), parseInt(listahora[0]), parseInt(listahora[1]), 0);
    }else{
        fecha = new Date(parseInt(listafecha[0]), parseInt(listafecha[1])-1, parseInt(listafecha[2]));
    }
    return fecha
}