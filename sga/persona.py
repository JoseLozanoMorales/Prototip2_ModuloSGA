from django.db import transaction
from django.db.models import Q
from django.http import JsonResponse, HttpResponseRedirect
from django.shortcuts import render, get_object_or_404
from sga.forms import PersonaForm
from sga.models import Persona

def view(request):
    data = {}

    if request.method == 'POST':
        action = request.POST.get('action')

        if action == 'add':
            try:
                form = PersonaForm(request.POST)
                if form.is_valid():
                    with transaction.atomic():
                        persona = form.save(commit=False)
                        persona.save(request)
                    return JsonResponse({'result': 'ok', 'id': persona.id})
                mensaje = ' '.join(error for errores in form.errors.values() for error in errores)
                return JsonResponse({'result': 'bad', 'mensaje': mensaje or 'Revise los datos ingresados.'})
            except Exception:
                return JsonResponse({'result': 'bad', 'mensaje': 'Error al guardar los datos.'})

        if action == 'editar':
            try:
                persona = Persona.objects.get(pk=int(request.POST['id']))
                form = PersonaForm(request.POST, instance=persona)
                if form.is_valid():
                    with transaction.atomic():
                        persona = form.save(commit=False)
                        persona.save(request)
                    return JsonResponse({'result': 'ok', 'id': persona.id})
                mensaje = ' '.join(error for errores in form.errors.values() for error in errores)
                return JsonResponse({'result': 'bad', 'mensaje': mensaje or 'Revise los datos ingresados.'})
            except Exception:
                return JsonResponse({'result': 'bad', 'mensaje': 'Error al guardar los datos.'})

        if action == 'eliminar':
            try:
                with transaction.atomic():
                    persona = Persona.objects.get(pk=int(request.POST['id']))
                    persona.status = False
                    persona.save(request)
                return JsonResponse({'result': 'ok', 'reload': True})
            except Exception:
                return JsonResponse({'result': 'bad', 'mensaje': 'Error al eliminar los datos.'})

        return HttpResponseRedirect(request.path)

    if 'action' in request.GET:
        action = request.GET['action']

        if action == 'add':
            data['title'] = 'Nueva persona'
            data['action'] = 'add'
            data['form'] = PersonaForm()
            return render(request, 'persona/persona_form.html', data)

        if action == 'editar':
            persona = get_object_or_404(Persona, pk=request.GET['id'])
            data['title'] = 'Editar persona'
            data['action'] = 'editar'
            data['id'] = persona.id
            data['persona'] = persona
            data['form'] = PersonaForm(instance=persona)
            return render(request, 'persona/persona_form.html', data)

        return HttpResponseRedirect(request.path)

    data['title'] = 'Personas'
    id = request.GET.get('id', None)
    buscar = request.GET.get('buscar', '').strip()
    filtro = Q(status=True)
    if id:
        data['id'] = id
        filtro &= Q(id=id)
    if buscar:
        filtro &= (
            Q(nombres__icontains=buscar) |
            Q(apellido1__icontains=buscar) |
            Q(apellido2__icontains=buscar) |
            Q(cedula__icontains=buscar) |
            Q(pasaporte__icontains=buscar)
        )
    data['buscar'] = buscar
    data['personas'] = Persona.objects.filter(filtro)
    return render(request, 'persona/persona_list.html', data)
