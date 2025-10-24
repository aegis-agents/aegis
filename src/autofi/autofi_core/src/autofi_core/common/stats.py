from prometheus_client import Counter, Summary

db_error_counter = Counter('aegis_db_saving_error', 'Db function error occurs')
third_party_error_counter = Counter('aegis_third_party_error', 'Third party error occurs',
                                    ['service_name'])
request_time = Summary('aegis_request_processing_seconds', 'Time spent processing a request',
                       ['service_name', 'method_name'])
