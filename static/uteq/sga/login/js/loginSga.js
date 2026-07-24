$(document).ready(function() {
	storeCsrfToken();

	$("#forgetFrom").hide();

	// preventCopyCutPasteInput('cod_captcha');
	preventCopyCutPasteInput('cod_captcha_conf');

	// reloadCaptcha('captchaImage');


	$('#loginFrom').submit(function(e){
		e.preventDefault();
		if (this.checkValidity() === false) {
			e.stopPropagation();
		} else {


			var form = $(this)[0];
			var formData = new FormData(form);
			login('POST', '/loginsga', formData);
		}
	});

//     olvidades tu contraseña
	$("#forgetFromPassword").click(function () {
		$(".loginFrom").hide();
		$(".forgetFrom").show();
	});

	$("#irlogin").click(function () {
		$(".loginFrom").show();
		$(".forgetFrom").hide();
	});

	$('#forgetFrom').submit(function(e) {
		e.preventDefault();
		if (this.checkValidity() === false) {
			e.stopPropagation();
			$('#error-message').show();
		} else {
			$('#error-message').hide();
			var form = $(this);
			form.attr('action', '/datos?action=generarnuevaclave');
			form.attr('method', 'post');
			$.post(form.attr('action'), form.serialize(), function(response) {
				if (response.result === 'ok'){
					abrirnotificacionmodal(response.mensaje, titulo = "Envío de correo", habilitarBtnOk = 1);
				}else{
					abrirnotificacionmodal(response.mensaje, titulo="Error");
				}
			}).fail(function() {
				abrirnotificacionmodal('Error al enviar los datos.');
			});
		}
		this.classList.add('was-validated');
	});
});
