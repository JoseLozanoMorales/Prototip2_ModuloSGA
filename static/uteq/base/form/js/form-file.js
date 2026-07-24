// // document.addEventListener('DOMContentLoaded', function() {
// //   // Encontrar todos los campos de archivo
// //   const fileInputs = document.querySelectorAll('.custom-file-input input[type="file"]');
// //
// //   fileInputs.forEach(input => {
// //     const container = input.closest('.custom-file-input');
// //     const fileText = container.querySelector('.custom-file-text');
// //     const fileButton = container.querySelector('.custom-file-button');
// //
// //     // Actualizar texto cuando se selecciona un archivo
// //     input.addEventListener('change', function() {
// //       if (this.files && this.files.length > 0) {
// //         fileText.textContent = this.files[0].name;
// //         container.classList.add('file-selected');
// //
// //         // Validar tamaño del archivo si hay un límite especificado
// //         validateFileSize(this, container);
// //       } else {
// //         fileText.textContent = 'seleccione un archivo';
// //         container.classList.remove('file-selected');
// //       }
// //     });
// //
// //     // Configurar eventos de arrastrar y soltar
// //     ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
// //       fileButton.addEventListener(eventName, preventDefaults, false);
// //     });
// //
// //     ['dragenter', 'dragover'].forEach(eventName => {
// //       fileButton.addEventListener(eventName, highlight, false);
// //     });
// //
// //     ['dragleave', 'drop'].forEach(eventName => {
// //       fileButton.addEventListener(eventName, unhighlight, false);
// //     });
// //
// //     fileButton.addEventListener('drop', handleDrop, false);
// //
// //     function preventDefaults(e) {
// //       e.preventDefault();
// //       e.stopPropagation();
// //     }
// //
// //     function highlight() {
// //       container.classList.add('drag-active');
// //     }
// //
// //     function unhighlight() {
// //       container.classList.remove('drag-active');
// //     }
// //
// //     function handleDrop(e) {
// //       const dt = e.dataTransfer;
// //       const files = dt.files;
// //
// //       if (files.length > 0) {
// //         input.files = files;
// //
// //         // Disparar evento change manualmente
// //         const event = new Event('change', { bubbles: true });
// //         input.dispatchEvent(event);
// //       }
// //     }
// //
// //     function validateFileSize(input, container) {
// //       // Obtener mensaje de ayuda para ver si hay restricción de tamaño
// //       const helpText = container.querySelector('.file-help-text');
// //       if (helpText && helpText.textContent.includes('MB') && input.files.length > 0) {
// //         const sizeMatch = helpText.textContent.match(/(\d+)MB/i);
// //         if (sizeMatch) {
// //           const maxSize = parseInt(sizeMatch[1]) * 1024 * 1024; // Convertir a bytes
// //           const fileSize = input.files[0].size;
// //
// //           if (fileSize > maxSize) {
// //             // Eliminar mensajes de error previos
// //             container.querySelectorAll('.invalid-feedback').forEach(el => el.remove());
// //
// //             // Crear mensaje de error
// //             const errorMsg = document.createElement('div');
// //             errorMsg.className = 'invalid-feedback';
// //             errorMsg.style.display = 'block';
// //             errorMsg.textContent = `El archivo excede el tamaño máximo de ${sizeMatch[1]}MB`;
// //
// //             container.appendChild(errorMsg);
// //             container.classList.add('has-error');
// //             container.classList.remove('file-selected');
// //           }
// //         }
// //       }
// //     }
// //   });
// // });
//
// /* Script compatible con jQuery 1.7 y Bootstrap 2 */
// $(function() {
//   // Usar función anónima para evitar conflictos de ámbito
//   (function($) {
//     // Encontrar todos los campos de archivo
//     $('.custom-file-input input[type="file"]').each(function() {
//       var $input = $(this);
//       var $container = $input.closest('.custom-file-input');
//       var $fileText = $container.find('.custom-file-text');
//       var $fileButton = $container.find('.custom-file-button');
//
//       // Hacer clic en el botón para activar el input
//       $fileButton.on('click', function(e) {
//         e.preventDefault();
//         $input.trigger('click');
//         return false; // Para navegadores antiguos
//       });
//
//       // Actualizar el texto cuando cambie el input
//       $input.on('change', function() {
//         if (this.files && this.files.length > 0) {
//           $fileText.text(this.files[0].name);
//           $container.addClass('file-selected');
//         } else {
//           // Compatibilidad con IE8/9 que no tiene la propiedad files
//           var filePath = $(this).val();
//           if (filePath) {
//             // Extraer solo el nombre del archivo de la ruta
//             var fileName = filePath.replace(/^.*[\\\/]/, '');
//             $fileText.text(fileName);
//             $container.addClass('file-selected');
//           } else {
//             $fileText.text('Ningún archivo seleccionado');
//             $container.removeClass('file-selected');
//           }
//         }
//       });
//
//       // Verificar si ya hay un archivo seleccionado al cargar
//       if ($fileText.text() && $fileText.text() !== 'Ningún archivo seleccionado') {
//         $container.addClass('file-selected');
//       }
//     });
//   })(jQuery); // Usar jQuery como $ para evitar conflictos con otros frameworks
// });