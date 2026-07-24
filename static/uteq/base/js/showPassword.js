$(document).ready(function() {
    $(".showPassword").on('click', function () {
        const inputPass = $(this).siblings('input');
        const icon = $(this).find('i');
        const isPassword = inputPass.attr('type') === 'password';

        inputPass.attr('type', isPassword ? 'text' : 'password');
        icon.toggleClass('bi-eye-fill bi-eye-slash-fill');
    });
});