import logging


logger = logging.getLogger(__name__)


def fechaletra_corta(fecha):
    fechafinal = ''
    if fecha.day == 1:
        fechafinal += 'al primer día '
    if fecha.day == 2:
        fechafinal += 'a los dos días '
    if fecha.day == 3:
        fechafinal += 'a los tres días '
    if fecha.day == 4:
        fechafinal += 'a los cuatro días '
    if fecha.day == 5:
        fechafinal += 'a los cinco días '
    if fecha.day == 6:
        fechafinal += 'a los seis días '
    if fecha.day == 7:
        fechafinal += 'a los siete días '
    if fecha.day == 8:
        fechafinal += 'a los ocho días '
    if fecha.day == 9:
        fechafinal += 'a los nueve días '
    if fecha.day == 10:
        fechafinal += 'a los diez días '
    if fecha.day == 11:
        fechafinal += 'a los once días '
    if fecha.day == 12:
        fechafinal += 'a los doce días '
    if fecha.day == 13:
        fechafinal += 'a los trece días '
    if fecha.day == 14:
        fechafinal += 'a los catorce días '
    if fecha.day == 15:
        fechafinal += 'a los quince días '
    if fecha.day == 16:
        fechafinal += 'a los dieciseis días '
    if fecha.day == 17:
        fechafinal += 'a los diecisiete días '
    if fecha.day == 18:
        fechafinal += 'a los dieciocho días '
    if fecha.day == 19:
        fechafinal += 'a los diecinueve días '
    if fecha.day == 20:
        fechafinal += 'a los veinte días '
    if fecha.day == 21:
        fechafinal += 'a los veintiun días '
    if fecha.day == 22:
        fechafinal += 'a los veintidos días '
    if fecha.day == 23:
        fechafinal += 'a los veintitres días '
    if fecha.day == 24:
        fechafinal += 'a los veinticuatro días '
    if fecha.day == 25:
        fechafinal += 'a los veinticinco días '
    if fecha.day == 26:
        fechafinal += 'a los veintiseis días '
    if fecha.day == 27:
        fechafinal += 'a los veintisiete días '
    if fecha.day == 28:
        fechafinal += 'a los veintiocho días '
    if fecha.day == 29:
        fechafinal += 'a los veintinueve días '
    if fecha.day == 30:
        fechafinal += 'a los treinta días '
    if fecha.day == 31:
        fechafinal += 'a los treinta y uno días '
    if fecha.month == 1:
        fechafinal += 'del mes de Enero del '
    if fecha.month == 2:
        fechafinal += 'del mes de Febrero del '
    if fecha.month == 3:
        fechafinal += 'del mes de Marzo del '
    if fecha.month == 4:
        fechafinal += 'del mes de Abril del '
    if fecha.month == 5:
        fechafinal += 'del mes de Mayo del '
    if fecha.month == 6:
        fechafinal += 'del mes de Junio del '
    if fecha.month == 7:
        fechafinal += 'del mes de Julio del '
    if fecha.month == 8:
        fechafinal += 'del mes de Agosto del '
    if fecha.month == 9:
        fechafinal += 'del mes de Septiembre del '
    if fecha.month == 10:
        fechafinal += 'del mes de Octubre del '
    if fecha.month == 11:
        fechafinal += 'del mes de Nomviembre del '
    if fecha.month == 12:
        fechafinal += 'del mes de Diciembre del '
    if fecha.year == 1998:
        fechafinal += 'mil novecientos noventa y ocho'
    if fecha.year == 1999:
        fechafinal += 'mil novecientos noventa y nueve'
    if fecha.year == 2000:
        fechafinal += 'dosmil'
    if fecha.year == 2001:
        fechafinal += 'dosmil uno'
    if fecha.year == 2002:
        fechafinal += 'dosmil dos'
    if fecha.year == 2003:
        fechafinal += 'dosmil tres'
    if fecha.year == 2004:
        fechafinal += 'dosmil cuatro'
    if fecha.year == 2005:
        fechafinal += 'dosmil cinco'
    if fecha.year == 2006:
        fechafinal += 'dosmil seis'
    if fecha.year == 2007:
        fechafinal += 'dosmil siete'
    if fecha.year == 2008:
        fechafinal += 'dosmil ocho'
    if fecha.year == 2009:
        fechafinal += 'dosmil nueve'
    if fecha.year == 2010:
        fechafinal += 'dosmil diez'
    if fecha.year == 2011:
        fechafinal += 'dosmil once'
    if fecha.year == 2012:
        fechafinal += 'dosmil doce'
    if fecha.year == 2013:
        fechafinal += 'dosmil trece'
    if fecha.year == 2014:
        fechafinal += 'dosmil catorce'
    if fecha.year == 2015:
        fechafinal += 'dosmil quince'
    if fecha.year == 2016:
        fechafinal += 'dosmil dieciseis'
    if fecha.year == 2017:
        fechafinal += 'dosmil diecisiete'
    if fecha.year == 2018:
        fechafinal += 'dosmil dieciocho'
    if fecha.year == 2019:
        fechafinal += 'dosmil diecinueve'
    if fecha.year == 2020:
        fechafinal += 'dosmil veinte'
    if fecha.year == 2021:
        fechafinal += 'dosmil veintiuno'
    if fecha.year == 2022:
        fechafinal += 'dosmil veintidos'
    if fecha.year == 2023:
        fechafinal += 'dosmil veintitres'
    if fecha.year == 2024:
        fechafinal += 'dosmil veinticuatro'
    if fecha.year == 2025:
        fechafinal += 'dosmil veinticinco'
    if fecha.year == 2026:
        fechafinal += 'dosmil veintiseis'
    if fecha.year == 2027:
        fechafinal += 'dosmil veintisiete'
    if fecha.year == 2028:
        fechafinal += 'dosmil veintiocho'
    if fecha.year == 2029:
        fechafinal += 'dosmil veintinueve'
    if fecha.year == 2030:
        fechafinal += 'dosmil treinta'
    return fechafinal


def fields_model(classname, app):
    try:
        d = locals()
        exec('from %s.models import %s' % (app, classname), globals(), d)
        # exec('from %s.models import %s' % (app, classname))
        fields = eval(classname + '._meta._fields()')
        return fields
    except:
        return []


def field_default_value_model(field):
    try:
        value = str(field)
        return value if 'django.db.models.fields.NOT_PROVIDED' not in value else ''
    except:
        return ''

def dia_semana_ennumero_fecha_act(fecha):
    dicdias = {'MONDAY': '1', 'TUESDAY': '2', 'WEDNESDAY': '3', 'THURSDAY': '4', 'FRIDAY': '5', 'SATURDAY': '6', 'SUNDAY': '7'}
    dia=dicdias[fecha.strftime('%A').upper()]
    return int(dia)

def dia_semana_enletra_fecha_act(fecha):
    dicdias = {'MONDAY': 'Lunes', 'TUESDAY': 'Martes', 'WEDNESDAY': 'Miercoles', 'THURSDAY': 'Jueves', 'FRIDAY': 'Viernes', 'SATURDAY': 'Sabado', 'SUNDAY': 'Domingo'}
    dia=dicdias[fecha.strftime('%A').upper()]
    return dia