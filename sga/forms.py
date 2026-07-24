from django import forms

from sga.models import Persona


class PersonaForm(forms.ModelForm):
    class Meta:
        model = Persona
        fields = ['nombres', 'apellido1', 'apellido2', 'cedula', 'pasaporte', 'ruc', 'nacimiento']
        widgets = {
            'nombres': forms.TextInput(attrs={'class': 'form-control', 'formwidth': '100'}),
            'apellido1': forms.TextInput(attrs={'class': 'form-control', 'formwidth': '100'}),
            'apellido2': forms.TextInput(attrs={'class': 'form-control', 'formwidth': '100'}),
            'cedula': forms.TextInput(attrs={'class': 'form-control', 'formwidth': '100'}),
            'pasaporte': forms.TextInput(attrs={'class': 'form-control', 'formwidth': '100'}),
            'ruc': forms.TextInput(attrs={'class': 'form-control', 'formwidth': '50'}),
            'nacimiento': forms.DateInput(attrs={'class': 'form-control', 'type': 'date', 'formwidth': '50'}),
        }

    def clean_cedula(self):
        cedula = self.cleaned_data.get('cedula', '').strip()
        if cedula:
            qs = Persona.objects.filter(cedula=cedula, status=True)
            if self.instance.pk:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise forms.ValidationError('Ya existe una persona registrada con esta cédula.')
        return cedula

    def clean_pasaporte(self):
        pasaporte = self.cleaned_data.get('pasaporte', '').strip()
        if pasaporte:
            qs = Persona.objects.filter(pasaporte=pasaporte, status=True)
            if self.instance.pk:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise forms.ValidationError('Ya existe una persona registrada con este pasaporte.')
        return pasaporte
