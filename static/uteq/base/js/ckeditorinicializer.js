// // Configuración global de CKEditor
// if (typeof CKEDITOR !== 'undefined') {
//     CKEDITOR.disableAutoInline = true;
// }
//
// // Gestión centralizada del estado
// const CKEditorManager = {
//     config: {
//         height: 300,
//         width: '100%',
//         removePlugins: 'exportpdf',
//         versionCheck: false,
//         toolbar: [
//             {name: 'document', items: ['Source', '-', 'NewPage', 'Templates']},
//             {name: 'clipboard', items: ['Cut', 'Copy', 'Paste', 'PasteText', 'PasteFromWord', '-', 'Undo', 'Redo']},
//             {name: 'editing', items: ['Find', 'SelectAll']},
//             {name: 'insert', items: ['Image', 'Table', 'HorizontalRule', 'Smiley', 'SpecialChar']},
//             '/',
//             {name: 'basicstyles', items: ['Bold', 'Italic', 'Underline', 'Strike', 'Subscript', 'Superscript', '-', 'RemoveFormat']},
//             {name: 'paragraph', items: ['NumberedList', 'BulletedList', '-', 'Outdent', 'Indent', '-', 'Blockquote', '-', 'JustifyLeft', 'JustifyCenter', 'JustifyRight', 'JustifyBlock']},
//             {name: 'links', items: ['Link', 'Unlink']},
//             '/',
//             {name: 'styles', items: ['Styles', 'Format', 'Font', 'FontSize']},
//             {name: 'colors', items: ['TextColor', 'BGColor']},
//             {name: 'tools', items: ['ShowBlocks']},
//             {name: 'yourcustomtools', items: ['Maximize']}
//         ]
//     },
//
//     isInitializing: false,
//     currentInstance: null,
//
//     /**
//      * Obtiene el textarea de descripción de forma segura
//      */
//     getTextarea() {
//         // Priorizar búsqueda por ID, luego por name
//         return document.getElementById('id_descripcion') ||
//                document.querySelector('textarea[name="descripcion"]');
//     },
//
//     /**
//      * Verifica si CKEditor está disponible
//      */
//     isAvailable() {
//         return typeof CKEDITOR !== 'undefined';
//     },
//
//     /**
//      * Destruye una instancia específica de forma segura
//      */
//     destroyInstance(instanceId) {
//         if (this.isAvailable() && CKEDITOR.instances[instanceId]) {
//             try {
//                 CKEDITOR.instances[instanceId].destroy(true);
//                 console.log(`✓ Instancia ${instanceId} destruida`);
//                 if (this.currentInstance === instanceId) {
//                     this.currentInstance = null;
//                 }
//                 return true;
//             } catch (error) {
//                 console.warn(`Error al destruir instancia ${instanceId}:`, error);
//                 return false;
//             }
//         }
//         return false;
//     },
//
//     /**
//      * Destruye todas las instancias activas
//      */
//     destroyAll() {
//         if (!this.isAvailable()) return;
//
//         Object.keys(CKEDITOR.instances).forEach(instanceId => {
//             this.destroyInstance(instanceId);
//         });
//         this.currentInstance = null;
//     },
//
//     /**
//      * Inicializa CKEditor en el textarea
//      */
//     initialize() {
//         console.log('→ initialize() ejecutándose...');
//
//         // Evitar inicializaciones múltiples simultáneas
//         if (this.isInitializing) {
//             console.log('⚠ Inicialización ya en progreso, cancelando');
//             return false;
//         }
//
//         if (!this.isAvailable()) {
//             console.error('❌ CKEditor no está disponible');
//             return false;
//         }
//
//         const textarea = this.getTextarea();
//         if (!textarea) {
//             console.warn('⚠ Textarea no encontrado en initialize()');
//             return false;
//         }
//
//         console.log('✓ Textarea encontrado, procediendo a inicializar...');
//
//         this.isInitializing = true;
//
//         // Asegurar que el textarea tenga el ID correcto
//         const textareaId = 'id_descripcion';
//         textarea.id = textareaId;
//
//         console.log('→ ID del textarea configurado:', textareaId);
//
//         // Destruir instancia existente si hay
//         if (CKEDITOR.instances[textareaId]) {
//             console.log('⚠ Ya existe una instancia, destruyendo...');
//             this.destroyInstance(textareaId);
//         }
//
//         // Crear nueva instancia
//         try {
//             console.log('→ Creando instancia de CKEditor...');
//             CKEDITOR.replace(textareaId, {
//                 ...this.config,
//                 on: {
//                     instanceReady: (evt) => {
//                         console.log('========================================');
//                         console.log('✓✓✓ CKEditor LISTO Y FUNCIONANDO ✓✓✓');
//                         console.log('========================================');
//                         $(`#${textareaId}`).css({"text-transform": "none"});
//                         this.isInitializing = false;
//                         this.currentInstance = textareaId;
//                     },
//                     destroy: () => {
//                         console.log(`→ CKEditor ${textareaId} destruido`);
//                     }
//                 }
//             });
//             console.log('✓ CKEDITOR.replace() ejecutado');
//             return true;
//         } catch (error) {
//             console.error('❌ Error al inicializar CKEditor:', error);
//             this.isInitializing = false;
//             return false;
//         }
//     },
//
//     /**
//      * Reinicializa el editor después de un delay
//      */
//     reinitialize(delay = 100) {
//         setTimeout(() => this.initialize(), delay);
//     },
//
//     /**
//      * Obtiene la instancia activa de CKEditor
//      */
//     getInstance() {
//         if (this.currentInstance && CKEDITOR.instances[this.currentInstance]) {
//             return CKEDITOR.instances[this.currentInstance];
//         }
//         // Buscar por ID conocido
//         if (CKEDITOR.instances['id_descripcion']) {
//             return CKEDITOR.instances['id_descripcion'];
//         }
//         return null;
//     },
//
//     /**
//      * Sincroniza el contenido de CKEditor con el textarea
//      * IMPORTANTE: Llamar antes de validar o enviar formularios
//      */
//     syncData() {
//         const instance = this.getInstance();
//         if (instance) {
//             try {
//                 instance.updateElement();
//                 console.log('✓ Datos de CKEditor sincronizados con textarea');
//                 return true;
//             } catch (error) {
//                 console.error('Error al sincronizar CKEditor:', error);
//                 return false;
//             }
//         } else {
//             console.warn('⚠ No hay instancia de CKEditor activa para sincronizar');
//             return false;
//         }
//     },
//
//     /**
//      * Obtiene el contenido actual del editor
//      */
//     getData() {
//         const instance = this.getInstance();
//         if (instance) {
//             return instance.getData();
//         }
//         return '';
//     },
//
//     /**
//      * Establece contenido en el editor
//      */
//     setData(content) {
//         const instance = this.getInstance();
//         if (instance) {
//             instance.setData(content);
//             return true;
//         }
//         return false;
//     },
//
//     /**
//      * Inicializa de forma segura esperando a que CKEditor esté listo
//      */
//     initWhenReady(maxRetries = 10, retryDelay = 200) {
//         let retries = 0;
//
//         const tryInit = () => {
//             if (this.isAvailable()) {
//                 this.initialize();
//             } else if (retries < maxRetries) {
//                 retries++;
//                 console.log(`⏳ Esperando CKEditor... intento ${retries}/${maxRetries}`);
//                 setTimeout(tryInit, retryDelay);
//             } else {
//                 console.error('❌ CKEditor no se cargó después de varios intentos');
//             }
//         };
//
//         tryInit();
//     }
// };


// if (typeof CKEDITOR !== 'undefined') {
//     CKEDITOR.disableAutoInline = true;
// }
//
// const CKEditorManager = {
//     config: {
//         height: 300,
//         width: '100%',
//         removePlugins: 'exportpdf',
//         versionCheck: false,
//         toolbar: [
//             {name: 'document', items: ['Source', '-', 'NewPage', 'Templates']},
//             {name: 'clipboard', items: ['Cut', 'Copy', 'Paste', 'PasteText', 'PasteFromWord', '-', 'Undo', 'Redo']},
//             {name: 'editing', items: ['Find', 'SelectAll']},
//             {name: 'insert', items: ['Image', 'Table', 'HorizontalRule', 'Smiley', 'SpecialChar']},
//             '/',
//             {name: 'basicstyles', items: ['Bold', 'Italic', 'Underline', 'Strike', 'Subscript', 'Superscript', '-', 'RemoveFormat']},
//             {name: 'paragraph', items: ['NumberedList', 'BulletedList', '-', 'Outdent', 'Indent', '-', 'Blockquote', '-', 'JustifyLeft', 'JustifyCenter', 'JustifyRight', 'JustifyBlock']},
//             {name: 'links', items: ['Link', 'Unlink']},
//             '/',
//             {name: 'styles', items: ['Styles', 'Format', 'Font', 'FontSize']},
//             {name: 'colors', items: ['TextColor', 'BGColor']},
//             {name: 'tools', items: ['ShowBlocks']},
//             {name: 'yourcustomtools', items: ['Maximize']}
//         ]
//     },
//
//     isAvailable() {
//         return typeof CKEDITOR !== 'undefined';
//     },
//
//     destroyAll() {
//         if (!this.isAvailable()) return;
//         Object.keys(CKEDITOR.instances).forEach(id => {
//             CKEDITOR.instances[id].destroy(true);
//         });
//         console.log("🧹 Todas las instancias CKEditor fueron destruidas");
//     },
//
//     initializeAll() {
//         if (!this.isAvailable()) return;
//         const textareas = document.querySelectorAll("textarea:not(.ckeditor-ready):not([readonly]):not([disabled])");
//         if (textareas.length === 0) {
//             console.warn("⚠ No hay textareas para inicializar CKEditor");
//             return;
//         }
//
//         textareas.forEach((ta, i) => {
//             if (!ta.id) ta.id = `ckeditor_${i}_${Date.now()}`;
//             ta.classList.add("ckeditor-ready");
//
//             if (CKEDITOR.instances[ta.id]) CKEDITOR.instances[ta.id].destroy(true);
//
//             CKEDITOR.replace(ta.id, {
//                 ...this.config,
//                 on: {
//                     instanceReady: () => console.log(`✅ CKEditor listo en ${ta.id}`)
//                 }
//             });
//         });
//     },
//
//     reinitialize(delay = 200) {
//         setTimeout(() => this.initializeAll(), delay);
//     },
//
//     syncAll() {
//         if (!this.isAvailable()) return;
//         Object.values(CKEDITOR.instances).forEach(instance => {
//             instance.updateElement();
//         });
//         console.log("🔄 Contenido de todos los CKEditor sincronizado con textareas");
//     },
//
//     getEmptyEditors() {
//         const empty = [];
//         Object.entries(CKEDITOR.instances).forEach(([id, instance]) => {
//             const data = instance.getData().replace(/<[^>]*>/g, '').trim();
//             if (data === "") empty.push(id);
//         });
//         return empty;
//     }
// };




// Configuración global de CKEditor
if (typeof CKEDITOR !== 'undefined') {
    CKEDITOR.disableAutoInline = true;
}

const CKEditorManager = {
    config: {
        height: 300,
        width: '100%',
        removePlugins: 'exportpdf',
        versionCheck: false,
        toolbar: [
            { name: 'document', items: ['Source', '-', 'NewPage', 'Templates'] },
            { name: 'clipboard', items: ['Cut', 'Copy', 'Paste', 'PasteText', 'PasteFromWord', '-', 'Undo', 'Redo'] },
            { name: 'editing', items: ['Find', 'SelectAll'] },
            { name: 'insert', items: ['Image', 'Table', 'HorizontalRule', 'Smiley', 'SpecialChar'] },
            '/',
            { name: 'basicstyles', items: ['Bold', 'Italic', 'Underline', 'Strike', 'Subscript', 'Superscript', '-', 'RemoveFormat'] },
            { name: 'paragraph', items: ['NumberedList', 'BulletedList', '-', 'Outdent', 'Indent', '-', 'Blockquote', '-', 'JustifyLeft', 'JustifyCenter', 'JustifyRight', 'JustifyBlock'] },
            { name: 'links', items: ['Link', 'Unlink'] },
            '/',
            { name: 'styles', items: ['Styles', 'Format', 'Font', 'FontSize'] },
            { name: 'colors', items: ['TextColor', 'BGColor'] },
            { name: 'tools', items: ['ShowBlocks'] },
            { name: 'yourcustomtools', items: ['Maximize'] }
        ]
    },

    /**
     * Verifica si CKEditor está disponible
     */
    isAvailable() {
        return typeof CKEDITOR !== 'undefined';
    },

    /**
     * Destruye todas las instancias activas
     */
    destroyAll() {
        if (!this.isAvailable()) return;
        Object.keys(CKEDITOR.instances).forEach(id => {
            CKEDITOR.instances[id].destroy(true);
        });
        console.log("🧹 Todas las instancias CKEditor fueron destruidas");
    },

    /**
     * Inicializa CKEditor en todos los textareas con atributo o clase 'ckeditor'
     */
    initializeAll() {
        if (!this.isAvailable()) {
            console.error('❌ CKEditor no está disponible');
            return;
        }

        const textareas = document.querySelectorAll('textarea[ckeditor], textarea.ckeditor');

        if (textareas.length === 0) {
            console.warn('⚠ No hay textareas con atributo ckeditor para inicializar');
            return;
        }

        textareas.forEach((ta, i) => {
            // Si no tiene id, le asignamos uno único
            if (!ta.id) ta.id = `ckeditor_${i}_${Date.now()}`;

            // Si ya existe una instancia previa, la destruimos
            if (CKEDITOR.instances[ta.id]) {
                CKEDITOR.instances[ta.id].destroy(true);
            }

            // Crear nueva instancia
            CKEDITOR.replace(ta.id, {
                ...this.config,
                on: {
                    instanceReady: () => {
                        console.log(`✅ CKEditor inicializado correctamente en: ${ta.id}`);
                        ta.classList.add('ckeditor-ready');
                    }
                }
            });
        });
    },

    /**
     * Re-inicializa los CKEditor (útil si agregas nuevos textareas dinámicamente)
     */
    reinitialize(delay = 200) {
        setTimeout(() => this.initializeAll(), delay);
    },

    /**
     * Sincroniza todos los CKEditor con sus textareas originales
     * (usar antes de enviar formularios)
     */
    syncAll() {
        if (!this.isAvailable()) return;
        Object.values(CKEDITOR.instances).forEach(instance => {
            instance.updateElement();
        });
        console.log("🔄 Todos los CKEditor sincronizados con sus textareas");
    },

    /**
     * Obtiene los editores vacíos (sin texto ni etiquetas)
     */
    getEmptyEditors() {
        const empty = [];
        Object.entries(CKEDITOR.instances).forEach(([id, instance]) => {
            const data = instance.getData().replace(/<[^>]*>/g, '').trim();
            if (data === "") empty.push(id);
        });
        return empty;
    }
};

// Inicializa automáticamente cuando el documento esté listo
document.addEventListener('DOMContentLoaded', () => {
    CKEditorManager.initializeAll();
});
