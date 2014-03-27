import json
import httplib2
import urllib

API_URL = 'http://localhost:8080/api'

def api(http_method, api_method, **params):

    url = API_URL + '/' + api_method + '/'

    if params:
        url += '?' + '&'.join([key + '=' + urllib.quote(value, '') for key,value in params.iteritems()])

    http = httplib2.Http()
    http.disable_ssl_certificate_validation = True
    r, content = http.request(url, http_method)
    if r.status == 200:
        return json.loads(content)
    else:
        error = 'Following request \n' + url + '\nfailed with error code ' + str(r.status) + ': ' + content
        raise Exception(error)

def get_info(user):
    return api('GET', 'timeclock/' + user)

def set_info(user, password):
    return api('PUT', 'timeclock', user=user, password=password)


if __name__ == '__main__':

    get_info('pesu')
    set_info('pesu', '123')