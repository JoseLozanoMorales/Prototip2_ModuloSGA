# -*- coding: UTF-8 -*-
from _decimal import Decimal, ROUND_HALF_UP
from django import template

from sga.funciones import fechaletra_corta, fields_model, field_default_value_model, \
    dia_semana_ennumero_fecha_act, dia_semana_enletra_fecha_act
from sga.models import Persona
from datetime import datetime, date
import textwrap

from sga.tuplas import MESES_CHOICES

register = template.Library()


def callmethod(obj, methodname):
    method = getattr(obj, methodname)
    if "__callArg" in obj.__dict__:
        ret = method(*obj.__callArg)
        del obj.__callArg
        return ret
    return method()


def args(obj, arg):
    if "__callArg" not in obj.__dict__:
        obj.__callArg = []
    obj.__callArg.append(arg)
    return obj


def suma(var, value=1):
    try:
        return var + value
    except Exception as ex:
        pass


def resta(var, value=1):
    return var - value


def restanumeros(var, value):
    return var - value


def multiplicanumeros(var, value):
    return Decimal(Decimal(var).quantize(Decimal('.01')) *  Decimal(value).quantize(Decimal('.01'))).quantize(Decimal('.01'))


def divide(value, arg):
    return int(value) / int(arg) if arg else 0


def porciento(value, arg):
    return round(value * 100 / float(arg), 2) if arg else 0


def calendarbox(var, dia):
    return var[dia]


def datakey(var, key):
    try:
        if key in var:
            return var[key]
    except TypeError:
        pass
    return None


def calendarboxdetails(var, dia):
    lista = var[dia]
    result = []
    for x in lista:
        b = [x.split(',')[0], x.split(',')[1]]
        result.append(b)
    return result


def calendarboxdetailsmostrar(var, dia):
    return var[dia]


def calendarboxdetails2(var, dia):
    lista = var[dia]
    result = []
    b = []
    for x in lista:
        b.append(x[0])
        b.append(x[1])
        b.append(x[2])
        b.append(x[3])
        result.append(b)
    return result


def times(number):
    return range(number)


def nombremescorto(fecha):
    if type(fecha) is str:
        return "%s" % fecha[:3].capitalize()
    else:
        return "%s %s" % (fecha.day, MESES_CHOICES[fecha.month - 1][1][:3].capitalize())


def substraer(value, rmostrar):
    return "%s" % value[:rmostrar]


def substraerconpunto(value, rmostrar):
    if len(value) > int(rmostrar):
        return "%s..." % value[:rmostrar]
    else:
        return "%s" % value[:rmostrar]

def substraersinpuntohasta(value, rmostrar):
    if len(value) > int(rmostrar):
        return "%s" % value[:rmostrar]
    else:
        return "%s" % value[:rmostrar]


def substraersinpuntodesde(value, rmostrar):
    if len(value) > int(rmostrar):
        return "%s" % value[rmostrar:]
    else:
        return ""


def cambiarlinea(value, cant):
    cadena, aux = '', ''
    for palabra in value.split(' '):
        aux = ''
        if len(palabra) > cant:
            palabradividida = textwrap.wrap(palabra, cant)
            for item in palabradividida:
                aux += item + "<br/>"
            palabra, aux = aux, ''
        cadena = cadena + " " + palabra
    return cadena


def contarcaracter(texto, cantidad):
    return len(texto) >= cantidad


def extraer(campo,cantidad):
    return campo[0:cantidad]


def nombremes(fecha):
    if type(fecha) is int:
        return "%s" % MESES_CHOICES[fecha - 1][1]
    elif type(fecha) is str:
        return ""
    else:
        return "%s" % MESES_CHOICES[fecha.month - 1][1]


def fechapermiso(fecha):
    if datetime.now().date() >= fecha:
        return True
    else:
        return False


def entrefechas(finicio,ffin):
    if datetime.now().date() >= finicio and datetime.now().date() <= ffin :
        return True
    else:
        return False


def datename(fecha):
    return u"%s de %s del %s" % (str(fecha.day).rjust(2, "0"), nombremes(fecha=fecha).capitalize(), fecha.year)


def datename_largo(fecha):
    return u"%s %s de %s del %s" % (dia_semana_enletra_fecha_act(fecha), str(fecha.day).rjust(2, "0"), nombremes(fecha=fecha).capitalize(), fecha.year)


def sumarfecha(fecha):
    meses = int(round((((datetime.now().date() - fecha).days)/30),0))
    return  meses


def sumarvalores(n1,n2):
    suma = int(n1) + int(n2)
    return  suma


def nombrepersona(usuario):
    if Persona.objects.values('id').filter(usuario=usuario).exists():
        return Persona.objects.filter(usuario=usuario)[0]
    return None


def encrypt(value):
    myencrip = ""
    if type(value) is int:
        value = str(value)
    i = 1
    for c in value.zfill(20):
        myencrip = myencrip + chr(int(44450/350) - ord(c) + int(i/int(9800/4900)))
        i = i + 1
    return myencrip


def encrypt_alu(value):
    myencrip = ""
    if type(value) is int:
        value = str(value)
    i = 1
    for c in value.zfill(20):
        myencrip = myencrip + chr(int(44450/350) - ord(c) + int(i/int(14700/4900)))
        i = i + 1
    return myencrip


def solo_caracteres(texto):
    acentos = [u'á', u'é', u'í', u'ó', u'ú', u'Á', u'É', u'Í', u'Ó', u'Ú', u'ñ', u'Ñ']
    alfabeto = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', '.', '/', '#', ',', ' ']
    resultado = ''
    for letra in texto:
        if letra in alfabeto:
            resultado += letra
        elif letra in acentos:
            if letra == u'á':
                resultado += 'a'
            elif letra == u'é':
                resultado += 'e'
            elif letra == u'í':
                resultado += 'i'
            elif letra == u'ó':
                resultado += 'o'
            elif letra == u'ú':
                resultado += 'u'
            elif letra == u'Á':
                resultado += 'A'
            elif letra == u'É':
                resultado += 'E'
            elif letra == u'Í':
                resultado += 'I'
            elif letra == u'Ó':
                resultado += 'O'
            elif letra == u'Ú':
                resultado += 'U'
            elif letra == u'Ñ':
                resultado += 'N'
            elif letra == u'ñ':
                resultado += 'n'
        else:
            resultado += '?'
    return resultado


def ceros(numero, cantidad):
    return str(numero).zfill(cantidad)


def fechamayor(fecha1, fecha2):
    if fecha1.date() > fecha2:
        return True
    else:
        return False


def transformar_n_l(n):
    arreglo = ['PRIMERO', 'SEGUNDO', 'TERCERO', 'CUARTO', 'QUINTO', 'SEXTO', 'SEPTIMO', 'OCTAVO', 'NOVENO', 'DÉCIMO', 'ONCEAVO']
    return arreglo[n - 1] if n else ""


def transformar_mes(n):
    arreglo = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
    return arreglo[int(n) - 1] if n else "SIN MES"


def diaenletra(dia):
    arreglo = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO']
    return arreglo[dia -1 ]


def dia_ennumero_fecha(fecha):
    return dia_semana_ennumero_fecha_act(fecha)


# NO TUVE MAS REMEDIO QUE HACER FUNCIONES MUERTAS PARA UN SOLO REPORTE PIDO MIL DISCULPAS A MIS ADMIRADORES ATT. CLOCKEM
def sumar_fm(value, lista):
    su = 0
    for l in lista:
        if value == l[0]:
            su += l[3]
    return su


def sumar_fh(value, lista):
    su = 0
    for l in lista:
        if value == l[0]:
            su += l[4]
    return su


def sumar_cm(value, lista):
    su = 0
    for l in lista:
        if value[1] == l[1] and value[0] == l[0]:
            su += l[3]
    return su


def sumar_ch(value, lista):
    su = 0
    for l in lista:
        if value[1] == l[1] and value[0] == l[0]:
            su += l[4]
    return su


def sumar_th(value, lista):
    su = 0
    for l in lista:
        su += l[4]
    return su


def sumar_tm(value, lista):
    su = 0
    for l in lista:
        su += l[3]
    return su


def sumar_pagineo(totalpagina, contador):
    suma = totalpagina + contador
    return suma
# AQUI TERMINA LAS FUNCIONES NO REUTILIZABLES :(


def rangonumeros(_min, args=None):
    _max, _step = None, None
    if args or args.__str__().isdigit():
        if not isinstance(args, int):
            _max, _step = map(int, args.split(','))
        else:
            _max = args
    args = filter(None, (_min, _max+1, _step))
    return range(*args)


def splitcadena(string, sep):
    return string.split(sep)


def convertir_numero_romano(num):
    import math
    Unidad = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX"]
    Decena = ["", "X", "XX", "XXX", "XL", "L", "LX", "LXX", "LXXX", "XC"]
    Centena = ["", "C", "CC", "CCC", "CD", "D", "DC", "DCC", "DCCC", "CM"]
    u = num % 10
    d = int(math.floor(num / 10)) % 10
    c = int(math.floor(num / 100))
    if (num >= 100):
        return Centena[c] + Decena[d] + Unidad[u]
    else:
        if (num >= 10):
            return Decena[d] + Unidad[u]
        else:
            return Unidad[num]


def null_to_decimal(valor, decimales=None):
    if not decimales is None:
        if decimales > 0:
            return Decimal(valor.__str__() if valor else 0).quantize(Decimal('.' + ''.zfill(decimales - 1) + '1'), rounding=ROUND_HALF_UP) if valor else 0
        else:
            return Decimal(valor.__str__() if valor else 0).quantize(Decimal('0'))
    return valor if valor else 0


def convertir_letra_abecedario_minuscula(valor):
    abecedario = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'ñ', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z']
    return abecedario[valor-1]


def convertir_letra_abecedario_mayuscula(valor):
    abecedario = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'Ñ', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z']
    return abecedario[valor-1]


def convertir_letra_i(valor):
    abecedario = ['i', 'ii', 'iii', 'iiii', 'iiiii', 'iiiiii', 'iiiiiii', 'iiiiiiii', 'iiiiiiiii', 'iiiiiiiiii']
    return abecedario[valor-1]


def convertir_letra_I(valor):
    abecedario = ['I', 'II', 'III', 'IIII', 'IIIII', 'IIIIII', 'IIIIIII', 'IIIIIIII', 'IIIIIIIII', 'IIIIIIIIII']
    return abecedario[valor-1]


def convertir_itemlist(var, var2):
    return (var, var2)


def convertir_itemlist2(var, var2):
    return [var, var2]


def tipo_archivo(nombre_archivo):
    a = nombre_archivo
    n = a[a.rindex(".") + 1:].lower()
    if n == 'pdf':
        return n
    elif n in ('doc', 'docx'):
        return 'word'
    elif n in ('xls', 'xlsx'):
        return 'excel'
    elif n in ('ppt', 'pptx'):
        return 'ppt'
    elif n in ('jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'):
        return 'imagen'
    elif n in ('mp4', 'wmv', 'mov', 'flv', '3gpp'):
        return 'video'
    return 'other'


def tipo_archivo_extencion(nombre_archivo):
    a = nombre_archivo
    n = a[a.rindex(".") + 1:]
    if n == 'pdf':
        return n + '.png'
    elif n == 'doc' or  n == 'docx':
        return 'word' + '.png'
    elif n in ['mp4', 'wmv', 'mov', 'flv', '3gpp']:
        return 'video.jpg'
    return 'other' + '.png'


def eliminar_car(cadena, eliminar):
    return cadena.replace(eliminar, '')


def convertir_fecha(s):
    if ':' in s:
        sep = ':'
    elif '-' in s:
        sep = '-'
    else:
        sep = '/'
    return date(int(s.split(sep)[2]), int(s.split(sep)[1]), int(s.split(sep)[0]))

def buscar_texto(cadena, texto):
    return texto in cadena


def emparejar_lista_con_total(lista, listatotal):
    if lista:
        total = listatotal.__len__()
        if total > 0:
            while lista.__len__() <= total:
                lista.extend(lista)
            return lista
    return []


def quitar_espacios(cadena):
    return cadena.strip() if cadena else cadena


def es_form(objeto):
    return '.html' in str(objeto)



def formato_moneda(valor):
    """
    Formatea un número al formato de moneda ecuatoriana: 1.433,00
    """
    if valor is None:
        return '0,00'

    try:
        valor = float(valor)
        parte_entera = int(valor)
        parte_decimal = int(round((valor - parte_entera) * 100))
        parte_entera_str = f"{parte_entera:,}".replace(',', '.')
        parte_decimal_str = f"{parte_decimal:02d}"
        return f"{parte_entera_str},{parte_decimal_str}"
    except (ValueError, TypeError):
        return '0,00'

def formatear_fecha(fecha):
    """
    Formatea una fecha al formato dd-MM-yyyy
    Uso en template: {{ fecha_actual|formatearfecha }}
    """
    if fecha:
        return fecha.strftime('%d-%m-%Y')
    return ''


def formatear_fecha_hora(fecha):
    """
    Formatea una fecha con hora al formato dd-MM-yyyy HH:mm
    Uso en template: {{ fecha_actual|formatearfechahora }}
    """
    if fecha:
        return fecha.strftime('%d-%m-%Y %H:%M')
    return ''

def get_item(dictionary, key):
    if dictionary and key:
        return dictionary.get(key)
    return None


def imagen_base64(imagen_field):
    import base64
    import os
    """
    Convierte un campo de imagen de Django a base64 para incrustar en HTML
    Lee la imagen del disco y la convierte a texto codificado
    """
    if not imagen_field:
        return ''

    try:
        # Obtener la ruta física del archivo desde la BD
        imagen_path = imagen_field.path

        # Verificar que existe
        if not os.path.exists(imagen_path):
            return ''

        # LEER LA IMAGEN DEL DISCO
        with open(imagen_path, 'rb') as image_file:
            imagen_data = image_file.read()

        # CONVERTIR A BASE64 (texto)
        imagen_base64 = base64.b64encode(imagen_data).decode('utf-8')

        # Detectar el tipo de imagen
        extension = os.path.splitext(imagen_path)[1].lower()
        mime_types = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.webp': 'image/webp',
            '.bmp': 'image/bmp',
        }
        mime_type = mime_types.get(extension, 'image/jpeg')

        # RETORNAR LA IMAGEN COMO TEXTO INCRUSTABLE
        return f'data:{mime_type};base64,{imagen_base64}'

    except Exception as e:
        print(f"Error al convertir imagen a base64: {e}")
        return ''


ESTADOS_CONFIG = {
    # Estados de generales
    'borrador': {
        'texto': 'BORRADOR',
        'clase': 'label-default',
        'icono': 'fa-file'
    },
    'pendiente': {
        'texto': 'PENDIENTE',
        'clase': 'label-info',
        'icono': 'fa-clock'
    },
    'solicitado': {
        'texto': 'SOLICITADO',
        'clase': 'label-warning',
        'icono': 'fa-paper-plane'
    },
    'aprobado': {
        'texto': 'APROBADO',
        'clase': 'label-success',
        'icono': 'fa-check-circle'
    },
    'en revision': {
        'texto': 'EN REVISIÓN',
        'clase': 'label-warning',
        'icono': 'fa-search'
    },
    'rechazado': {
        'texto': 'RECHAZADO',
        'clase': 'label-important',
        'icono': 'fa-times-circle'
    },
    'cancelado': {
        'texto': 'CANCELADO',
        'clase': 'label-inverse',
        'icono': 'fa-ban'
    },

    # Estados de Evaluación
    'revision por comite': {
        'texto': 'REVISIÓN POR CÓMITE',
        'clase': 'label-primary',
        'icono': 'fa-users'
    },
    'valido para evaluacion externa': {
        'texto': 'VÁLIDO PARA EVALUACIÓN EXTERNA',
        'clase': 'label-success',
        'icono': 'fa-check-square'
    },
    'no admitido': {
        'texto': 'NO ADMITIDO',
        'clase': 'label-important',
        'icono': 'fa-exclamation-triangle'
    },
    'revision por pares': {
        'texto': 'REVISIÓN POR PARES',
        'clase': 'label-primary',
        'icono': 'fa-user-friends'
    },
    'evaluado parcialmente': {
        'texto': 'EVALUADO PARCIALMENTE',
        'clase': 'label-warning',
        'icono': 'fa-tasks'
    },
}


register.filter('diaenletra', diaenletra)
register.filter('filedsmodel', fields_model)
register.filter('fielddefaultvaluemodel', field_default_value_model)
register.filter('ceros', ceros)
register.filter('fechamayor', fechamayor)
register.filter('fechaletra_corta', fechaletra_corta)
register.filter('times', times)
register.filter("call", callmethod)
register.filter("args", args)
register.filter("transformar_n_l", transformar_n_l)
register.filter("transformar_mes", transformar_mes)
register.filter("suma", suma)
register.filter("sumar_fm", sumar_fm)
register.filter("sumar_fh", sumar_fh)
register.filter("sumar_cm", sumar_cm)
register.filter("sumar_ch", sumar_ch)
register.filter("sumar_th", sumar_th)
register.filter("sumar_pagineo", sumar_pagineo)
register.filter("sumar_tm", sumar_tm)
register.filter("resta", resta)
register.filter("restanumeros", restanumeros)
register.filter("multiplicanumeros", multiplicanumeros)
register.filter("entrefechas", entrefechas)
register.filter("porciento", porciento)
register.filter("nombremescorto", nombremescorto)
register.filter("substraer", substraer)
register.filter("nombremes", nombremes)
register.filter("fechapermiso", fechapermiso)
register.filter("nombrepersona", nombrepersona)
register.filter("datename", datename)
register.filter("sumarfecha", sumarfecha)
register.filter("sumarvalores", sumarvalores)
register.filter("divide", divide)
register.filter("calendarbox", calendarbox)
register.filter("calendarboxdetails", calendarboxdetails)
register.filter("calendarboxdetails2", calendarboxdetails2)
register.filter("calendarboxdetailsmostrar", calendarboxdetailsmostrar)
register.filter("solo_caracteres", solo_caracteres)
register.filter("rangonumeros", rangonumeros)
register.filter("splitcadena", splitcadena)
register.filter("encrypt", encrypt)
register.filter("encrypt_alu", encrypt_alu)
register.filter("substraerconpunto", substraerconpunto)
register.filter("substraersinpuntohasta", substraersinpuntohasta)
register.filter("substraersinpuntodesde", substraersinpuntodesde)
register.filter("contarcaracter", contarcaracter)
register.filter("cambiarlinea", cambiarlinea)
register.filter("extraer", extraer)
register.filter("convertir_numero_romano", convertir_numero_romano)
register.filter("dia_numero_fecha", dia_ennumero_fecha)
register.filter("datename_largo", datename_largo)
register.filter("null_to_decimal", null_to_decimal)
register.filter("convertir_letra_abecedario_minuscula", convertir_letra_abecedario_minuscula)
register.filter("convertir_letra_abecedario_mayuscula", convertir_letra_abecedario_mayuscula)
register.filter("convertir_letra_i", convertir_letra_i)
register.filter("convertir_letra_I", convertir_letra_I)
register.filter("convertir_itemlist", convertir_itemlist)
register.filter("convertir_itemlist2", convertir_itemlist2)
register.filter("tipo_archivo", tipo_archivo)
register.filter("tipo_archivo_extencion", tipo_archivo_extencion)
register.filter("eliminar_car", eliminar_car)
register.filter("datakey", datakey)
register.filter("convertir_fecha", convertir_fecha)
register.filter("buscar_texto", buscar_texto)
register.filter("emparejar_lista_con_total", emparejar_lista_con_total)
register.filter("quitar_espacios", quitar_espacios)
register.filter("es_form", es_form)
register.filter('formato_moneda', formato_moneda)
register.filter('formatear_fecha', formatear_fecha)
register.filter('formatear_fecha_hora', formatear_fecha_hora)
register.filter('get_item', get_item)
register.filter('imagen_base64', imagen_base64)

# Componentizando html
@register.inclusion_tag('componenteHtml/filaForm.html')
def info_field(label, value, default=None):
    return {'label': label, 'value': value if value is not None else default}

@register.filter
def dictkey(d, key):
    if not d:
        return None
    return d.get(key)

@register.filter()
def nuevo_safe(value):
    import re
    from django.utils.safestring import mark_safe
    if not value:
        return ""
    html = str(value)
    html = re.sub(r'style="[^"]*"', '', html, flags=re.IGNORECASE)
    html = re.sub(r'class="[^"]*"', '', html, flags=re.IGNORECASE)
    html = re.sub(
        r'(color|background-color)\s*:\s*(undefined|notimplemented)[^;"]*;?',
        '',
        html,
        flags=re.IGNORECASE
    )
    html = re.sub(r'<span[^>]*>(.*?)</span>', r'\1', html, flags=re.IGNORECASE)
    return mark_safe(html)


@register.filter
def filename(value):
    import os
    return os.path.basename(str(value))

@register.filter
def get_item(dictionary, key):
    if not isinstance(dictionary, dict):
        return 0
    # Intenta con la clave tal cual, luego como str, luego como int
    if key in dictionary:
        return dictionary[key]
    if str(key) in dictionary:
        return dictionary[str(key)]
    try:
        return dictionary.get(int(key), 0)
    except (ValueError, TypeError):
        return 0
