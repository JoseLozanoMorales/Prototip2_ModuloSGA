function contarCaracteres(elemento) {
    let textLength = elemento.val().split('').filter(caracter => /[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ]/.test(caracter)).length;
    let maxCaracteres = elemento.attr('maxLength');
    let minCaracteres = elemento.attr('minlength');
    let nearLimit = minCaracteres;
    let resta = maxCaracteres - textLength;
    let elementoNumCaracter = elemento.parent().find('.charCount');
    let CharAlert = elemento.parent().find('.CharAlert');
    let minChar = elemento.parent().find('.minChar');
    let maxChar = elemento.parent().find('.maxChar');
    minChar.html(minCaracteres);
    maxChar.html(maxCaracteres);

    // Recortar el valor si supera el máximo
    if (textLength > maxCaracteres) {
        elemento.val(elemento.val().substring(0, maxCaracteres));
        resta = 0; // Ajustar la resta al máximo permitido
    }
    actualizarContadorCaracteres(elementoNumCaracter, CharAlert, textLength, nearLimit);
}


function actualizarContadorCaracteres(elementoNumCaracter, CharAlert, textLength, minCaracteres, maxCaracteres) {
    elementoNumCaracter.html(textLength);
    CharAlert.removeClass('nearLimit');

    const editorContainer = elementoNumCaracter.closest('.form-section').find('.ckeditor-container');

    if (textLength > maxCaracteres) {
        CharAlert.addClass('fullLimit');
        editorContainer.addClass('limit-reached');
    } else if (parseInt(textLength) >= parseInt(maxCaracteres) * 0.9) {
        CharAlert.addClass('nearLimit');
    } else if (textLength < minCaracteres) {
        CharAlert.addClass('fullLimit');
        editorContainer.removeClass('limit-reached');
    } else {
        CharAlert.removeClass('fullLimit', 'nearLimit'); // Vuelve al estilo normal
        editorContainer.removeClass('limit-reached');
    }
}

function contarCaracteresCKEDITOR(contenidoHtml, elementoTextarea = null) {
    // Crear un elemento div temporal
    let tempDiv = document.createElement("div");
    // Asignar el HTML al contenido del div temporal
    tempDiv.innerHTML = contenidoHtml;
    let textoLimpio = tempDiv.textContent.replace(/\s/g, '');
    let textLength = textoLimpio.split('').filter(caracter => /[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ]/.test(caracter)).length;

    let maxCaracteres = elementoTextarea ? parseInt(elementoTextarea.attr('maxLength')) : 500;
    let minCaracteres = elementoTextarea ? parseInt(elementoTextarea.attr('minlength')) : 50;
    let nearLimit = maxCaracteres;
    // Obtener elemento del grupo correcto que le corresponde presentar el numero
    if (elementoTextarea != null) {
        let CharAlert = elementoTextarea.parent().find(".CharAlert");
        let elementoNumCaracter = elementoTextarea.parent().find(".charCount");
        let minChar = elementoTextarea.parent().find(".minChar");
        let maxChar = elementoTextarea.parent().find(".maxChar");
        minChar.html(minCaracteres);
        maxChar.html(maxCaracteres);
        actualizarContadorCaracteres(elementoNumCaracter, CharAlert, textLength, minCaracteres, maxCaracteres);
    } else {
        let elementoNumCaracter = $('.charCount');
        let CharAlert = $('.CharAlert');
        actualizarContadorCaracteres(elementoNumCaracter, CharAlert, textLength, minCaracteres, maxCaracteres);
    }

    return textLength;
}

// Nueva función para truncar contenido HTML manteniendo formato básico
function truncarContenidoHTML(htmlContent, maxLength) {
    let tempDiv = document.createElement("div");
    tempDiv.innerHTML = htmlContent;
    let textoLimpio = tempDiv.textContent || tempDiv.innerText || "";
    let caracteresValidos = textoLimpio.split('').filter(caracter => /[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ]/.test(caracter));

    if (caracteresValidos.length <= maxLength) {
        return htmlContent;
    }

    // Truncar manteniendo formato básico
    let caracteresContados = 0;
    let resultado = '';
    let tempNode = document.createElement("div");
    tempNode.innerHTML = htmlContent;

    function procesarNodo(nodo) {
        if (caracteresContados >= maxLength) return false;

        if (nodo.nodeType === Node.TEXT_NODE) {
            let texto = nodo.textContent;
            let caracteresTexto = texto.split('').filter(caracter => /[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ]/.test(caracter));

            if (caracteresContados + caracteresTexto.length <= maxLength) {
                resultado += texto;
                caracteresContados += caracteresTexto.length;
            } else {
                let caracteresRestantes = maxLength - caracteresContados;
                let textoTruncado = '';
                let contadorLocal = 0;

                for (let char of texto) {
                    if (/[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ]/.test(char)) {
                        if (contadorLocal >= caracteresRestantes) break;
                        contadorLocal++;
                    }
                    textoTruncado += char;
                }

                resultado += textoTruncado;
                caracteresContados = maxLength;
                return false;
            }
        } else if (nodo.nodeType === Node.ELEMENT_NODE) {
            let tagName = nodo.tagName.toLowerCase();
            if (['b', 'strong', 'i', 'em', 'u', 'br', 'p'].includes(tagName)) {
                if (tagName === 'br') {
                    resultado += '<br>';
                } else if (tagName === 'p') {
                    resultado += '<p>';
                    for (let child of nodo.childNodes) {
                        if (!procesarNodo(child)) break;
                    }
                    resultado += '</p>';
                    return caracteresContados < maxLength;
                } else {
                    resultado += `<${tagName}>`;
                    for (let child of nodo.childNodes) {
                        if (!procesarNodo(child)) break;
                    }
                    resultado += `</${tagName}>`;
                }
            } else {
                for (let child of nodo.childNodes) {
                    if (!procesarNodo(child)) break;
                }
            }
        }
        return caracteresContados < maxLength;
    }

    for (let child of tempNode.childNodes) {
        if (!procesarNodo(child)) break;
    }

    return resultado;
}


function agregarLimitacionCaracteres(editor, textareaElement) {
    const $textarea = $(textareaElement);
    const maxCaracteres = parseInt($textarea.attr('maxLength'));

    if (!maxCaracteres) return;

    function contar() {
        contarCaracteresCKEDITOR(editor.getData(), $textarea);
    }

    // Bloquear escritura extra al llegar al límite
    editor.on('key', function (event) {
        const textLength = contarCaracteresCKEDITOR(editor.getData(), $textarea);

        // Permitir teclas de control (borrar, flechas, enter, tab, etc.)
        const controlKeys = [8, 46, 37, 38, 39, 40, 13, 9];
        if (textLength >= maxCaracteres && !controlKeys.includes(event.data.keyCode)) {
            event.cancel(); // Bloquea la entrada
            return false;
        }
    });

    // Bloquear pegado si supera el límite
    editor.on('paste', function (event) {
        const textLength = contarCaracteresCKEDITOR(editor.getData(), $textarea);

        if (textLength >= maxCaracteres) {
            event.cancel(); // Cancela el pegado
            return false;
        }

        // Si al pegar excede el límite, truncar antes de insertarlo
        setTimeout(() => {
            const nuevoTexto = editor.getData();
            const nuevoLength = contarCaracteresCKEDITOR(nuevoTexto, $textarea);
            if (nuevoLength > maxCaracteres) {
                const contenidoTruncado = truncarContenidoHTML(nuevoTexto, maxCaracteres);
                editor.setData(contenidoTruncado);
            }
        }, 10);
    });

    // Contar al iniciar
    editor.on('instanceReady', function () {
        contar();
    });

    // Contar también en cada cambio (solo para actualizar UI)
    editor.on('change', contar);
}


// CONTAR POR PALABRAS
// Cuenta solo palabras *finalizadas* (se cuentan cuando aparece un espacio después de una secuencia de caracteres no-espacio)
function countCompletedWordsFromText(text) {
    let inWord = false;
    let completed = 0;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (/\s/.test(ch)) {
            if (inWord) {
                completed++;
                inWord = false;
            }
        } else {
            inWord = true;
        }
    }
    return completed;
}

// Escapa texto plano para ponerlo seguro dentro de HTML (usado al reconstruir)
function escapeHtml(str) {
    return str.replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

/* ----------------- Conteo y UI (CKEditor + textarea) ---------------------- */

function actualizarContadorPalabras(elementoNumPalabras, CharAlert, wordCount, minPalabras, maxPalabras) {
    elementoNumPalabras.html(wordCount);
    CharAlert.removeClass('nearLimit fullLimit');

    const editorContainer = elementoNumPalabras.closest('.form-section').find('.ckeditor-container');

    if (wordCount > maxPalabras) {
        CharAlert.addClass('fullLimit');
        editorContainer.addClass('limit-reached');
    } else if (wordCount >= Math.floor(maxPalabras * 0.9)) {
        CharAlert.addClass('nearLimit');
    } else if (wordCount < minPalabras) {
        CharAlert.addClass('fullLimit');
        editorContainer.removeClass('limit-reached');
    } else {
        editorContainer.removeClass('limit-reached');
    }
}

// contarPalabrasCKEDITOR: cuenta palabras finalizadas en contenido HTML de CKEditor
function contarPalabrasCKEDITOR(contenidoHtml, elementoTextarea = null) {
    let tempDiv = document.createElement("div");
    tempDiv.innerHTML = contenidoHtml;
    let textoLimpio = tempDiv.textContent || tempDiv.innerText || "";
    let wordCount = countCompletedWordsFromText(textoLimpio);

    let maxPalabras = elementoTextarea ? parseInt(elementoTextarea.attr('maxWords')) : 250;
    let minPalabras = elementoTextarea ? parseInt(elementoTextarea.attr('minWords')) : 0;

    if (elementoTextarea != null) {
        let CharAlert = elementoTextarea.parent().find(".CharAlert");
        let elementoNumPalabras = elementoTextarea.parent().find(".charCount");
        let minChar = elementoTextarea.parent().find(".minChar");
        let maxChar = elementoTextarea.parent().find(".maxChar");
        minChar.html(minPalabras);
        maxChar.html(maxPalabras);
        actualizarContadorPalabras(elementoNumPalabras, CharAlert, wordCount, minPalabras, maxPalabras);
    } else {
        let elementoNumPalabras = $('.charCount');
        let CharAlert = $('.CharAlert');
        actualizarContadorPalabras(elementoNumPalabras, CharAlert, wordCount, minPalabras, maxPalabras);
    }

    return wordCount;
}

// Para textarea normal (no HTML). Cuenta y recorta si excede (recorta por palabras finalizadas).
function contarPalabrasTextarea(elemento) {
    let tx = elemento.val() || "";
    let wordCount = countCompletedWordsFromText(tx);
    let maxPalabras = parseInt(elemento.attr('maxWords')) || 250;
    let minPalabras = parseInt(elemento.attr('minWords')) || 0;

    // Si hay más palabras finalizadas de las permitidas, recortamos hasta la última palabra permitida.
    if (wordCount > maxPalabras) {
        // recortar hasta la posición donde aparece el maxPalabras-ésimo espacio que finaliza la palabra
        let inWord = false, completed = 0, cutIndex = tx.length;
        for (let i = 0; i < tx.length; i++) {
            const ch = tx[i];
            if (/\s/.test(ch)) {
                if (inWord) {
                    completed++;
                    if (completed === maxPalabras) {
                        cutIndex = i; // no incluyo el espacio que finalizaría la palabra
                        break;
                    }
                    inWord = false;
                }
            } else {
                inWord = true;
            }
        }
        tx = tx.slice(0, cutIndex).trimRight();
        elemento.val(tx);
        wordCount = maxPalabras;
    }

    let elementoNumPalabras = elemento.parent().find('.charCount');
    let CharAlert = elemento.parent().find('.CharAlert');
    let minChar = elemento.parent().find('.minChar');
    let maxChar = elemento.parent().find('.maxChar');
    minChar.html(minPalabras);
    maxChar.html(maxPalabras);
    actualizarContadorPalabras(elementoNumPalabras, CharAlert, wordCount, minPalabras, maxPalabras);

    return wordCount;
}

/* ------------- Truncado de HTML manteniendo formato básico ----------------- */

/* Recorre nodos, cuenta palabras finalizadas (cuando aparece un whitespace)
   y corta el HTML en el punto donde se alcanzan maxWords completadas. */
function truncarContenidoHTMLporPalabrasFinalizadas(htmlContent, maxWords) {
    let tempNode = document.createElement("div");
    tempNode.innerHTML = htmlContent;

    let resultado = '';
    let completed = 0;
    let inWord = false;

    function procesarNodo(nodo) {
        if (completed >= maxWords) return false;

        if (nodo.nodeType === Node.TEXT_NODE) {
            let texto = nodo.nodeValue;
            let buf = '';

            for (let i = 0; i < texto.length; i++) {
                const ch = texto[i];
                if (/\s/.test(ch)) {
                    if (inWord) {
                        completed++;
                        // Si alcanzamos el máximo, no incluimos esta palabra finalizada
                        if (completed >= maxWords) {
                            // añadimos el texto acumulado sin el espacio final
                            resultado += escapeHtml(buf);
                            return false;
                        }
                    }
                    inWord = false;
                    buf += ch;
                } else {
                    inWord = true;
                    buf += ch;
                }
            }

            // Si no rompimos el bucle, agregamos el buffer escapado
            resultado += escapeHtml(buf);
            return true;
        } else if (nodo.nodeType === Node.ELEMENT_NODE) {
            let tagName = nodo.tagName.toLowerCase();

            // Mantenemos un conjunto de etiquetas básicas (puedes añadir más si quieres)
            if (['b', 'strong', 'i', 'em', 'u', 'br', 'p', 'span', 'a'].includes(tagName)) {
                if (tagName === 'br') {
                    resultado += '<br>';
                } else if (tagName === 'p') {
                    resultado += '<p>';
                    for (let child of nodo.childNodes) {
                        if (!procesarNodo(child)) break;
                    }
                    resultado += '</p>';
                    return completed < maxWords;
                } else {
                    // abrimos tag (sin atributos para simplicidad)
                    resultado += `<${tagName}>`;
                    for (let child of nodo.childNodes) {
                        if (!procesarNodo(child)) break;
                    }
                    resultado += `</${tagName}>`;
                }
            } else {
                // Elementos no listados: procesar hijos pero no reproducir la etiqueta
                for (let child of nodo.childNodes) {
                    if (!procesarNodo(child)) break;
                }
            }
            return completed < maxWords;
        }
        return true;
    }

    for (let child of tempNode.childNodes) {
        if (!procesarNodo(child)) break;
    }

    return resultado;
}

/* ----------------- Limitación para CKEditor (por palabras finalizadas) ---- */

function agregarLimitacionPalabras(editor, textareaElement) {
    const $textarea = $(textareaElement);
    const maxPalabras = parseInt($textarea.attr('maxWords')) || 250;

    if (!maxPalabras) return;

    function contarYActualizar() {
        contarPalabrasCKEDITOR(editor.getData(), $textarea);
    }

    // Bloquear la tecla espacio / enter cuando ya hay maxPalabras palabras finalizadas.
    editor.on('key', function (event) {
        const keyCode = event.data.keyCode;
        // teclas que generan finalización de palabra típicamente: espacio(32) y enter(13), tab(9) -> suele no finalizar palabra
        if (keyCode === 32 || keyCode === 13) {
            const texto = (function () {
                let temp = document.createElement('div');
                temp.innerHTML = editor.getData();
                return temp.textContent || temp.innerText || "";
            })();
            const completed = countCompletedWordsFromText(texto);
            if (completed >= maxPalabras) {
                // bloquea terminar otra palabra
                event.cancel();
                // opcional: mensaje visual (puedes reemplazar por notificación UI)
                if (!editor._warnedWordLimit) {
                    console.warn(`Límite de ${maxPalabras} palabras alcanzado.`);
                    editor._warnedWordLimit = true;
                    setTimeout(() => editor._warnedWordLimit = false, 1500);
                }
                return false;
            }
        }
        // permitir otras teclas (letras, borrar, flechas...)
    });

    // Manejar pegado: si el pegado genera más palabras finalizadas de las permitidas, truncar
    editor.on('paste', function (event) {
        // dejemos que el paste suceda y luego truncamos si es necesario
        setTimeout(() => {
            const nuevoHtml = editor.getData();
            let temp = document.createElement('div');
            temp.innerHTML = nuevoHtml;
            const texto = temp.textContent || temp.innerText || "";
            const completed = countCompletedWordsFromText(texto);
            if (completed > maxPalabras) {
                const truncatedHtml = truncarContenidoHTMLporPalabrasFinalizadas(nuevoHtml, maxPalabras);
                // reestablecer contenido truncado
                editor.setData(truncatedHtml);
                // opcional: mostrar aviso
                console.warn(`Pegado truncado para respetar máximo de ${maxPalabras} palabras.`);
            }
            contarYActualizar();
        }, 10);
    });

    // Contar inicial y en cambios para UI
    editor.on('instanceReady', function () {
        contarYActualizar();
    });
    editor.on('change', function () {
        contarYActualizar();
    });
}

