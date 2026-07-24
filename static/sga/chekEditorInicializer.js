const campoEditorCK  = (elementoId) => {
    return CKEDITOR.replace(elementoId,
        { toolbar: 'Custom',
            toolbarStartupExpanded : false,
            toolbarCanCollapse : false,
            toolbar_Custom: [
                ['Print'],
                ['Bold','Italic','Underline'],
                ['NumberedList', 'BulletedList', 'Outdent', 'Indent', 'JustifyLeft','JustifyCenter','JustifyRight','JustifyBlock']
            ],
            height: '150px'
        });
};
