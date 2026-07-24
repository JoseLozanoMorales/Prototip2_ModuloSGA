document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('.auto-submit-select').forEach(function (select) {
        select.addEventListener('change', function () {
            if (select.form) {
                select.form.submit();
            }
        });
    });
});
