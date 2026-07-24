// let toastQueue = []; // Cola para manejar los toasts
// let isProcessing = false; // Flag para saber si estamos procesando la cola
//
// //Variables globales Iconos
// const iconos = {
//     exito: `<svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 16 16">
// 				<path
// 					d="M2 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2H2zm10.03 4.97a.75.75 0 0 1 .011 1.05l-3.992 4.99a.75.75 0 0 1-1.08.02L4.324 8.384a.75.75 0 1 1 1.06-1.06l2.094 2.093 3.473-4.425a.75.75 0 0 1 1.08-.022z"
// 				/>
// 			</svg>`,
//     error: `<svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 16 16">
// 				<path
// 					d="M11.46.146A.5.5 0 0 0 11.107 0H4.893a.5.5 0 0 0-.353.146L.146 4.54A.5.5 0 0 0 0 4.893v6.214a.5.5 0 0 0 .146.353l4.394 4.394a.5.5 0 0 0 .353.146h6.214a.5.5 0 0 0 .353-.146l4.394-4.394a.5.5 0 0 0 .146-.353V4.893a.5.5 0 0 0-.146-.353L11.46.146zM8 4c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 4.995A.905.905 0 0 1 8 4zm.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"
// 				/>
// 			</svg>`,
//     info: `<svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 16 16">
// 				<path
// 					d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm.93-9.412-1 4.705c-.07.34.029.533.304.533.194 0 .487-.07.686-.246l-.088.416c-.287.346-.92.598-1.465.598-.703 0-1.002-.422-.808-1.319l.738-3.468c.064-.293.006-.399-.287-.47l-.451-.081.082-.381 2.29-.287zM8 5.5a1 1 0 1 1 0-2 1 1 0 0 1 0 2z"
// 				/>
// 			</svg>`,
//     warning: `<svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 16 16">
// 				<path
// 					d="M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767L8.982 1.566zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5zm.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"
// 				/>
// 			</svg>`,
//     infor: `<svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 16 16">
//                 <path
//                     d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm.93-9.412l-1 4.705c-.07.34.029.533.304.533.194 0 .487-.07.686-.246l-.088.416c-.287.346-.92.598-1.465.598-.703 0-1.002-.422-.808-1.319l.738-3.468c.064-.293.006-.399-.287-.47l-.451-.081.082-.381 2.29-.287zM8 5.5a1 1 0 1 1 0-2 1 1 0 0 1 0 2z"
//                 />
//             </svg>`
// };
//
//
// const cerrarToast = (id) => {
//     const toast = document.getElementById(id);
//     if (!toast) return;
//
//     toast.classList.add('cerrando');
//
//     const handleAnimacionCierre = (e) => {
//         if (e.animationName === 'cierre') {
//             toast.removeEventListener('animationend', handleAnimacionCierre);
//             toast.remove();
//             procesarColaCierres(); // Procesar el siguiente toast
//         }
//     };
//
//     toast.addEventListener('animationend', handleAnimacionCierre);
// };
//
// const procesarColaCierres = () => {
//     if (toastQueue.length === 0) {
//         isProcessing = false;
//         return;
//     }
//
//     isProcessing = true;
//     const toastId = toastQueue.shift(); // Tomar el primer toast de la cola
//     cerrarToast(toastId);
// };
//
// const agregarToastACola = (toastId) => {
//     toastQueue.push(toastId);
//     if (!isProcessing) {
//         procesarColaCierres();
//     }
// };
//
// const agregarToast = ({id, tipo, titulo, descripcion, autoCierre, url}, contenedorToast) => {
//     // Crear elemento base del toast
//     const nuevoToast = crearElementoToast(id, tipo, autoCierre);
//
// // Agregar contenido HTML
//     agregarContenidoToast(nuevoToast, tipo, titulo, descripcion, url, id);
//
//     // Configurar eventos
//     configurarEventosToast(nuevoToast, url, id, autoCierre);
//
//     // Agregar toast al contenedor
//     contenedorToast.appendChild(nuevoToast);
//
// };
//
// const crearElementoToast = (id, tipo, autoCierre) => {
//     const nuevoToast = document.createElement('div');
//     nuevoToast.classList.add('toast', tipo);
//     if (autoCierre) {
//         nuevoToast.classList.add('autoCierre');
//     }
//     nuevoToast.id = id;
//     return nuevoToast;
// };
//
// const agregarContenidoToast = (nuevoToast, tipo, titulo, descripcion, url) => {
//     nuevoToast.innerHTML = `
//         <div class="contenido" data-url="${url}">
//             <div class="icono">
//                 ${iconos[tipo]}
//             </div>
//             <div class="texto">
//                 <p class="titulo">${titulo}</p>
//                 <p class="descripcion">${descripcion}</p>
//             </div>
//         </div>
//         <button class="btn-cerrar">
//             <div class="icono">
//                 <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 16 16">
//                     <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
//                 </svg>
//             </div>
//         </button>
//     `;
// };
//
//
// const configurarEventosToast = (nuevoToast, url, id, autoCierre) => {
//     // Configurar evento de click en el contenido
//     const contenido = nuevoToast.querySelector('.contenido');
//     if (url) {
//         contenido.addEventListener('click', () => {
//             // window.location.href = url;
//             $.post("/datos_alerta_notificaciones", {'action': 'leer_notificacion', 'id': id}, function (data) {
//                 if (data.result == 'ok') {
//                     window.location.href = url;
//                 }
//                 $.unblockUI();
//                 return false;
//             }, "json");
//         });
//         contenido.style.cursor = 'pointer';
//     }
//
//     // Configurar autocierre si está habilitado
//     if (autoCierre) {
//         setTimeout(() => {
//             agregarToastACola(id);
//         }, 6000);
//     }
//
//     // Configurar evento de animación
//     nuevoToast.addEventListener('animationend', (e) => {
//         if (e.animationName === 'cierre') {
//             nuevoToast.remove();
//         }
//     });
//
//     // Configurar botón de cerrar
//     const btnCerrar = nuevoToast.querySelector('.btn-cerrar');
//     btnCerrar.addEventListener('click', () => {
//         agregarToastACola(id);
//     });
// };
