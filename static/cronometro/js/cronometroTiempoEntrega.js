
function startTimer(divParent, fecha, inicio, fin) {
    var now = new Date(fecha);
    var inicio = new Date(inicio);
    var fin = new Date(fin);

    // Crear html
    const divItem1 = document.createElement("div");
    const divItem2 = document.createElement("div");
    const divItem3 = document.createElement("div");
    const divItem4 = document.createElement("div");

    const divDia = document.createElement("div");
    const divHora = document.createElement("div");
    const divMinuto = document.createElement("div");
    const divSegundo = document.createElement("div");

    divDia.className = 'cronometroItemDiv';
    divHora.className = 'cronometroItemDiv';
    divMinuto.className = 'cronometroItemDiv';
    divSegundo.className = 'cronometroItemDiv';

    const divItemText1 = document.createElement("div");
    const divItemText2 = document.createElement("div");
    const divItemText3 = document.createElement("div");
    const divItemText4 = document.createElement("div");

    divItemText1.innerText = 'Día'
    divItemText2.innerText = 'Hor'
    divItemText3.innerText = 'Min'
    divItemText4.innerText = 'Seg'

    divItemText1.className = "divItemText";
    divItemText2.className = "divItemText";
    divItemText3.className = "divItemText";
    divItemText4.className = "divItemText";

    divDia.appendChild(divItem1);
    divHora.appendChild(divItem2);
    divMinuto.appendChild(divItem3);
    divSegundo.appendChild(divItem4);

    divDia.appendChild(divItemText1);
    divHora.appendChild(divItemText2);
    divMinuto.appendChild(divItemText3);
    divSegundo.appendChild(divItemText4);

    divItem1.id = "diaDiv";
    divItem2.id = "horaDiv";
    divItem3.id = "minutoDiv";
    divItem4.id = "segundoDiv";

    divItem1.className = "itemValorDiv";
    divItem2.className = "itemValorDiv";
    divItem3.className = "itemValorDiv";
    divItem4.className = "itemValorDiv";

    divParent.appendChild(divDia);
    divParent.appendChild(divHora);
    divParent.appendChild(divMinuto);
    divParent.appendChild(divSegundo);


    var startTimerInterval = setInterval(function() {
        let dias= '00';
        let horas = '00';
        let minutos = '00';
        let segundos = '00';
        let totalSegundos = parseInt(fin - now);
        if (inicio > now){
            totalSegundos = 0;
        }
        if (totalSegundos > 0) {
            dias = Math.floor(totalSegundos / 864e5);
            horas = Math.floor((totalSegundos % 864e5) / 3600000);
            minutos = Math.floor((totalSegundos % 864e5 % 3600000) / 60000);
            segundos = Math.floor((totalSegundos % 864e5 % 3600000 % 60000) / 1000);

            if (dias < 10) {
                dias = '0' + dias;
            }
            if (horas < 10) {
                horas = '0' + horas;
            }
            if (minutos < 10) {
                minutos = '0' + minutos;
            }
            if (segundos < 10) {
                segundos = '0' + segundos;
            }
        }

        let elementoDia = document.getElementById("diaDiv");
        let elementoHora = document.getElementById("horaDiv");
        let elementoMinuto = document.getElementById("minutoDiv");
        let elementoSegundo = document.getElementById("segundoDiv");

        elementoDia.innerText = dias;
        elementoHora.innerText = horas;
        elementoMinuto.innerText = minutos;
        elementoSegundo.innerText = segundos;
        now.setSeconds(now.getSeconds() + 1);
        if ((parseInt(dias) + parseInt(horas) + parseInt(minutos) + parseInt(segundos)) === 0){
            clearInterval(startTimerInterval);
        }

    }, 1000);
}

function puedeEntregarActividad(elemento, fecha, inicio, fin) {
    var now = new Date(fecha);
    var inicio = new Date(inicio);
    var fin = new Date(fin);
    var puedeEntregarInterval = setInterval(function () {
        if (fin >= now && inicio <= now) {
            if (typeof elemento === "object") {
                elemento.style.display = "block";
                clearInterval(puedeEntregarInterval);
            }
        } else {
            if (typeof elemento === "object") {
                elemento.style.display = "none";
                clearInterval(puedeEntregarInterval);
            }
            if (typeof elemento === "string") {
                location.href = elemento;
            }
        }
        now.setSeconds(now.getSeconds() + 1);
    }, 1000);
}