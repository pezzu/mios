import json
import httplib2
import urllib

import settings

def api(http_method, api_method, **params):

    url = settings.server_url + '/' + api_method + '/'

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
    return api('GET', user)

def loginout(user, password):
    return api('PUT', 'do', user=user, password=password)


if __name__ == '__main__':

    get_info('pesu')
    loginout('pesu', '123')