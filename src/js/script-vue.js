const { createApp, ref } = Vue

app = null

function getCookieValueByName(name) {
    var match = document.cookie.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'));
    return (match ? decodeURIComponent(match[3]) : null);
}

siteRoot = getCookieValueByName('site_root')
clientRootCookie = getCookieValueByName('client_root')
siteIdCookie = getCookieValueByName('site_id')

function showNotyAlert(message) {
    new Noty({
        text: message,
        type: 'error',
        theme: "metroui",
        closeWith: ['click', 'button'],
        layout: "bottomRight",
        timeout: 10000
    }).show();
}

const params = new URLSearchParams(window.location.search);

/* TechDemo Vue app */
createApp({
    data() {
        return {
            debug: false,
            // debug: params.get('debug') === 'true',
            postMessageResult: '',
            postMessageMarker: '',
            can_post_to_table: 'unknown',
            posts_to_table_reason: 'Not authenticated',
            can_upload_files: 'unknown',
            upload_files_reason: 'Not authenticated',
            body: 'Dummy body',
            title: 'Dummy title',
            site_title: 'Site Title',
            searchResultMessage: '',
            queryResultMessage: '',
            siteRoot: siteRoot,
            clientRoot: clientRootCookie,
            siteId: siteIdCookie,
            searchingState: 'searchingState pending',
            searchingStateVisible: true,
            operationInProgress: false,
            siteConfig: '',
            siteState: null,
            on_Create_Database: 'CREATE TABLE "posts" ("body" varchar, "title" varchar)',
            backendQueryParameters: { "table": 'posts' },
            count_only: false,
            querySectionParams: [],
            prettify: undefined,
            file_size: 0,
            is_site_admin: false,
            delay: 1000,
            maximumPopulateCount: 5,
            jsContent: 'This text was modified by javascript served by this Serveronet client',
            entity_id: '',
            isAuthenticated: false,
            sql: '',
            identity_visitor_id: null,
            foundRecords: 0,
            queryRecords: [],
            record: { id: '' },
            value: '',
            visitorFile: '',
            visitorFiles: [],
        }
    },

    async mounted() {
        app = this

        this.querySectionParams.push({ key: 'where', isEnabled: false, queryParam: [['title', '!=', 'excluded_title']] })
        this.querySectionParams.push({ key: 'whereNull', isEnabled: false, queryParam: ['body'] })
        this.querySectionParams.push({ key: 'whereNotNull', isEnabled: false, queryParam: ['pinned'] })
        this.querySectionParams.push({ key: 'whereIn', isEnabled: false, queryParam: ['body', ['Sample post body', 'different body']] })
        this.querySectionParams.push({ key: 'whereNotIn', isEnabled: false, queryParam: ['body', ['Excluded body']] })
        this.querySectionParams.push({ key: 'orderBy', isEnabled: false, queryParam: ['title', 'desc'] })
        this.querySectionParams.push({ key: 'limit', isEnabled: false, queryParam: '3' })

        await this.regenerateCsrfCookie()
        await this.checkIsAuthenticated()
        if (this.isAuthenticated) {
            this.checkCanPostToTable()
            this.checkCanUploadFiles()
            this.getVisitorState()
        }
        this.getClientConfig()

        this.getSiteState()
        this.getMimeTypesMapping()

        document.title = document.title + ' ' + getCookieValueByName('client_root')
    },
    methods: {
        tfynu($b) {
            if ($b == 'unknown') {
                $s = 'Unknown'
            } else if ($b == true || $b == 'false') {
                $s = 'Yes'
            } else if ($b == false || $b == 'false') {
                $s = 'No'
            }
            // $b ? $s = 'Yes' : $s = 'No'
            return $s;
        },

        genVisitorResourcePath(visitorFile) {
            return '/visitor_file/' + visitorFile.entity_id + '_' + visitorFile.original_file_name
        },

        formatDate(str) {
            const [datePart] = str.split('_');
            // Extract the first 14 digits for YYYYMMDDHHmmss
            const dateStr = datePart.slice(0, 14);
            const year = parseInt(dateStr.slice(0, 4), 10);
            const month = parseInt(dateStr.slice(4, 6), 10) - 1; // JS months are 0-based
            const day = parseInt(dateStr.slice(6, 8), 10);
            const hour = parseInt(dateStr.slice(8, 10), 10);
            const minute = parseInt(dateStr.slice(10, 12), 10);
            const second = parseInt(dateStr.slice(12, 14), 10);
            const date = new Date(year, month, day, hour, minute, second);
            return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false // Use 24-hour format. Set to true for 12-hour format (AM/PM)
            });
        },

        getResourceHref(visitorFile) {
            return './visitor_file/' + visitorFile.entity_id + '_' + visitorFile.original_file_name
        },

        getShortAddress(address, withUnderscore = false) {
            if (!address) return '';
            if (address == 'Unknown') return '';
            connectChar = withUnderscore ? '_' : '-';
            return address.substring(0, 5) + connectChar + address.substring((address.length) - 5, address.length);
        },

        async getSiteState() {
            console.log('getSiteState')
            this.searchingState = 'Searching...'
            this.searchingStateVisible = true
            response = await axios({
                url: this.siteRoot + "site_api/v1/site_state",
                method: 'POST',
                data: { "site_id": this.site_id }
            })
            if (response.data.success == true) {
                this.siteState = response.data.data
                this.site_title = this.siteState.most_recent_site_definition.title
            } else {
                showNotyAlert(response.data.message)
            }
        },

        async regenerateCsrfCookie() {
            try {
                await axios.get(this.siteRoot + "site_api/v1/csrf-cookie")
            } catch (error) {

            }
        },

        onCsrfCookieExpired() {
            console.log('onCsrfCookieExpired')
            if (confirm('This page has expired.\nWould you like to refresh the page?') == true)
                location.reload()

        },

        onCsrfCookieExpiredRequiresAuth() {
            console.log('onCsrfCookieExpiredRequiresAuth')
            if (this.isAuthenticated)
                if (confirm('This page has expired.\nWould you like to refresh the page?') == true)
                    location.reload()
        },

        onThrottlingOccured() {
            showNotyAlert('Too Many Attempts. Try again later.')
        },

        async postRecord(sampleData) {

            if (!this.body && !this.title) {
                this.postMessageResult = 'Title and Body is required'
                return
            }
            if (!this.isAuthenticated) {
                this.postMessageResult = 'Please login to the Site first'
                return
            }
            this.operationInProgress = true
            this.postMessageMarker = '⌛'
            this.postMessageResult = ''
            record = {}
            record._sn_entity_id = this.entity_id
            record.title = this.title
            record.body = this.body
            record.pinned = 1
            record._sn_table = 'posts' //Target table to try to insert this record
            record._sn_visitor_verification_key_base64 = this._sn_visitor_verification_key_base64

            recordJson = record
            if (sampleData) {
                recordJson = sampleData
            }

            record_json = JSON.stringify(recordJson)

            if (this.entity_id == '') {
                api_endpoint = "site_api/v1/visitor_record_create"
            } else {
                api_endpoint = "site_api/v1/visitor_record_update"
            }

            response = await axios.post(
                this.siteRoot + api_endpoint,
                { '_sn_record_json': record_json, 'debug': this.debug }
            )
                .catch((error) => {
                    this.operationInProgress = false
                    this.postMessageMarker = '❌'
                    this.postMessageResult = 'Error Code: ' + response.status
                    showNotyAlert(error.message)
                    if (error.response.status == 419) {
                        this.onCsrfCookieExpiredRequiresAuth()
                    } else if (error.response.status == 429) {
                        this.onThrottlingOccured()
                    }
                })

            this.postMessageResult = response.data
            this.operationInProgress = false
            if (response.data.success == true) {
                this.postMessageMarker = '✅'

                this.title = this.debug ? 'new title' : ''
                this.body = ''
                this.entity_id = ''
            } else {
                showNotyAlert(response.data.message)
            }
        },

        async createGrantRecord(table) {

            record = {}
            record._sn_grantee_visitor_id = this.grantee_visitor_id
            record._sn_is_grant_record = true
            record._sn_table = table

            recordJson = record
            record_json = JSON.stringify(recordJson)

            response = await axios.post(
                this.siteRoot + "site_api/v1/visitor_record_create",
                { '_sn_record_json': record_json }
            )
                .catch((error) => {

                    showNotyAlert(error.message)
                    if (error.response.status == 419) {
                        this.onCsrfCookieExpiredRequiresAuth()
                    } else if (error.response.status == 429) {
                        this.onThrottlingOccured()
                    }
                })

            if (response.data.success == true) {
                showNotyAlert(JSON.stringify(response.data))
                this.entity_id = ''
            } else {
                showNotyAlert(response.data.message)
            }
        },

        restoreRecordForEdit(record) {
            this.entity_id = record._sn_entity_id
            this.title = record.title
            this.body = record.body
            this._sn_visitor_verification_key_base64 = record._sn_visitor_verification_key_base64
        },

        async deleteRecord(record, $event) {

            processedRecord = {}
            processedRecord._sn_entity_id = record._sn_entity_id
            processedRecord._sn_table = 'posts'
            processedRecord._sn_mark_as_deleted = true
            processedRecord._sn_visitor_verification_key_base64 = record._sn_visitor_verification_key_base64

            record_json = JSON.stringify(processedRecord)
            console.log($event)
            this.operationInProgress = true
            response = await axios({
                url: this.siteRoot + "site_api/v1/visitor_record_update",
                method: 'post',
                data: { '_sn_record_json': record_json, 'debug': this.debug}
            })
                .catch((error) => {
                    this.operationInProgress = false
                    showNotyAlert(error.message)
                    if (error.response.status == 419) {
                        this.onCsrfCookieExpiredRequiresAuth()
                    }
                })
            this.operationInProgress = false
            this.postMessageResult = response.data
            if (response.data.success == true) {
                $event.target.parentElement.innerText = 'Deleted'
            } else {
                showNotyAlert(response.data.message)
            }
        },

        

        async search() {
            this.operationInProgress = true

            this.foundRecords = [];

            this.queries = { 0: null }
            this.queryParameters = {}
            this.queryParameters.table = 'posts'

            if (this.search_text != '') {
                this.queryParameters.orWhere = [
                    ['title', 'like', '%' + this.search_text + '%'], ['body', 'like', '%' + this.search_text + '%']
                ]
            }

            response = await axios({
                url: this.siteRoot + "site_api/v1/query_endpoint",
                method: 'post',
                data: { 'query_parameters': this.queryParameters, 'debug': this.debug }
            })
                .catch((error) => {
                    this.operationInProgress = false
                    showNotyAlert(error.message)
                    if (error.response.status == 419) {
                        this.onCsrfCookieExpired()
                    }
                })
            this.operationInProgress = false
            if (response.data.success == true) {
                this.searchResultMessage = ''
                response.data.data.forEach(element => {
                    this.foundRecords.push(JSON.parse(element._sn_record_json))
                });
            } else {
                this.searchResultMessage = response.data
            }
        },

        async showCount() {
            this.count_only = true
            this.executeQuery()
        },

        async executeQuery() {
            this.operationInProgress = true
            this.queryRecords = [];

            response = await axios({
                url: this.siteRoot + "site_api/v1/query_endpoint",
                method: 'post',
                data: { 'query_parameters': this.backendQueryParameters, 'count_only': this.count_only, 'debug': this.debug }
            })
                .catch((error) => {
                    this.operationInProgress = false
                    showNotyAlert(error.message)
                    if (error.response.status == 419) {
                        this.onCsrfCookieExpired()
                    }
                })

            this.operationInProgress = false
            this.count_only = false
            if (response.data.success == true) {
                this.queryResultMessage = ''

                if (response.data.data.records_count > -1) {
                    console.log('records_count: ' + (response.data.data.records_count ?? ''))
                    showNotyAlert('Count: ' + response.data.data.records_count ?? 0)
                    return;
                }
                debug_data = response.data.debug_data

                this.sql = response.data?.sql_query ?? ''
                this.queryRecords = response.data.data
                this.queryRecords.forEach(element => {
                    console.log(element._sn_entity_id + ' ' + element._sn_signer + ' ' + element._sn_visitor_id + ' ' + this.identity_visitor_id)
                    derived_visitor_id = element._sn_entity_id.split('_')[1]
                    if (
                        element._sn_signer === this.identity_visitor_id
                        || element._sn_visitor_id === this.identity_visitor_id
                        || derived_visitor_id === this.identity_visitor_id
                        || this.is_site_admin
                    ) {
                        element.editable = true
                    } else {
                        element.editable = false
                    }
                });
            } else {
                this.queryResultMessage = response.data
            }
        },

        toggleQuery(param) {
            row = this.querySectionParams.find((element) => {
                return element.key == param
            });
            console.log('toggleQuery ' + param + ' ' + row.isEnabled)

            row.isEnabled = !row.isEnabled
            console.log('toggleQuery ' + param + ' ' + row.isEnabled)

            this.querySectionParams.forEach(element => {
                if (element.isEnabled) {
                    this.backendQueryParameters[element.key] = element.queryParam
                } else {
                    this.backendQueryParameters[element.key] = undefined
                }

            });
        },

        inlineStringify(backendQueryParameters) {
            return JSON.stringify(backendQueryParameters, undefined, this.prettify)
        },

        getButtonCss(param) {
            row = this.querySectionParams.find((element) => {
                return element.key == param
            });
            if (row.isEnabled) {
                return "btn btn-success"
            } else {
                return "btn btn-danger"
            }
        },

        togglePrettify(backendQueryParameters) {
            if (this.prettify === undefined) {
                this.prettify = 2
            } else {
                this.prettify = undefined
            }
        },

        async checkIsAuthenticated() {
            this.operationInProgress = true
            response = await axios({
                method: 'POST',
                url: this.siteRoot + "site_api/v1/is_authenticated"
            })

            if (response.data.success == true) {
                this.isAuthenticated = response.data.data.is_authenticated
                if (response.data.data.is_authenticated == true) {
                    this.authenticatedState = "Authenticated as " + response.data.data.visitor_id
                    this.identity_visitor_id = response.data.data.visitor_id
                } else {
                    this.authenticatedState = "Not Authenticated"
                }
            } else {
                this.authenticatedState = 'Problem while checking authentication state'
            }
            this.operationInProgress = false
        },

        async getMimeTypesMapping() {
            response = await axios.post(this.siteRoot + "site_api/v1/mime_types_mapping")
            if (response.data.success == true) {
                this.mimeTypesMapping = response.data.data
            } else {
                showNotyAlert(response.data.message)
            }
        },

        async getClientConfig() {
            response = await axios.post(this.siteRoot + "site_api/v1/client_config")
            if (response.data.success == true) {
                this.clientConfig = response.data.data
            } else {
                showNotyAlert(response.data.message)
            }
        },

        async getCurrentVisitorFiles() {

            this.queryParameters = {}
            this.queryParameters._sn_visitor_id = this.identity_visitor_id
            this.operationInProgress = true
            response = await axios({
                url: this.siteRoot + "site_api/v1/visitor_files",
                method: 'post',
                data: { 'query_parameters': this.queryParameters, 'debug': this.debug },
            })
                .catch((error) => {
                    this.operationInProgress = false
                    showNotyAlert(error.message)
                    if (error.response.status == 419) {
                        this.onCsrfCookieExpired()
                    }
                })

            this.operationInProgress = false
            if (response.data.success == true) {
                this.visitorFiles = response.data.data

                this.visitorFiles.forEach(element => {
                    // console.log(element._sn_entity_id + ' ' + element._sn_signer + ' ' + element._sn_visitor_id + ' ' + this.identity_visitor_id)
                    derived_visitor_id = element.entity_id.split('_')[1]
                    if (
                        element.signer === this.identity_visitor_id
                        || element.visitor_id === this.identity_visitor_id
                        || derived_visitor_id === this.identity_visitor_id
                        || this.is_site_admin
                    ) {
                        element.editable = true
                    } else {
                        element.editable = false
                    }
                });

            } else {
                showNotyAlert(response.data.message)
            }
        },

        async getAllVisitorFiles() {
            this.operationInProgress = true
            response = await axios({
                url: this.siteRoot + "site_api/v1/visitor_files",
                method: 'post',
                data: { 'query_parameters': {}, 'debug': this.debug},
            })
                .catch((error) => {
                    this.operationInProgress = false
                    showNotyAlert(error.message)
                    if (error.response.status == 419) {
                        this.onCsrfCookieExpiredRequiresAuth()
                    }
                })

            this.operationInProgress = false
            if (response.data.success == true) {
                this.visitorFiles = response.data.data

                this.visitorFiles.forEach(element => {
                    // console.log(element._sn_entity_id + ' ' + element._sn_signer + ' ' + element._sn_visitor_id + ' ' + this.identity_visitor_id)
                    derived_visitor_id = element.entity_id.split('_')[1]
                    if (
                        element.signer === this.identity_visitor_id
                        || element.visitor_id === this.identity_visitor_id
                        || derived_visitor_id === this.identity_visitor_id
                        || this.is_site_admin
                    ) {
                        element.editable = true
                    } else {
                        element.editable = false
                    }
                });

            } else {
                showNotyAlert(response.data.message)
            }
        },

        async getVisitorState() {
            this.operationInProgress = true
            response = await axios.post(this.siteRoot + "site_api/v1/get_visitor_state")
                .catch((error) => {
                    this.operationInProgress = false
                    this.visitorState = {
                        "visitor_id": "Unknown",
                        "is_site_admin": "Unknown",
                    }
                    showNotyAlert(error.message)
                    if (error.response.status == 419) {
                        this.onCsrfCookieExpired()
                    }
                })

            this.operationInProgress = false
            if (response.data.success == true) {
                this.visitorState = response.data.data
                this.is_site_admin = this.visitorState?.is_site_admin
            } else {
                showNotyAlert(response.data.message)
            }
        },
        async checkCanPostToTable() {

            if (!this.isAuthenticated) {
                this.can_post_to_table = false
                this.posts_to_table_reason = 'Not Authenticated'
                return
            }

            this.can_post_to_table = 'unknown'
            this.posts_to_table_reason = 'Checking...'
            response = await axios({
                url: this.siteRoot + "site_api/v1/check_can_post_to_table",
                method: 'post',
                data: { table: 'posts' }
            })
                .catch((error) => {
                    this.operationInProgress = false
                    showNotyAlert(error.message)
                    if (error.response.status == 419) {
                        this.onCsrfCookieExpiredRequiresAuth()
                    }
                })

            if (response.data.success == true) {
                this.can_post_to_table = response.data.data.can_post_to_table
                this.posts_to_table_reason = response.data.data.posts_to_table_reason
            } else {
                showNotyAlert(response.data.message)
            }
        },

        async checkCanUploadFiles() {
            if (!this.isAuthenticated) {
                this.can_upload_files = false
                this.upload_files_reason = 'Not Authenticated'
            }
            this.can_upload_files = 'unknown'
            this.upload_files_reason = 'Checking...'
            this.operationInProgress = true
            response = await axios.post(this.siteRoot + "site_api/v1/check_can_upload")
                .catch((error) => {
                    this.operationInProgress = false
                    showNotyAlert(error.message)
                    if (error.response.status == 419) {
                        this.onCsrfCookieExpiredRequiresAuth()
                    } else if (error.response.status == 401) {
                        this.can_upload_files = false
                        this.upload_files_reason = 'Unauthenticated'
                    }
                })

            this.operationInProgress = false
            if (response.data.success == true) {
                this.can_upload_files = response.data.data.can_upload_files
                this.upload_files_reason = response.data.data.upload_files_reason
            } else {
                showNotyAlert(response.data.message)
            }
        },

        totalUploadedFiles() {
            total = 0
            this.visitorFiles.forEach(element => {
                total += parseInt(element.file_size)
            });
            return Math.round(total / 1024)
        },

        async deleteVisitorResource(_sn_entity_id) {
            response = await axios({
                url: this.siteRoot + "site_api/v1/visitor_file_delete",
                method: 'post',
                data: { '_sn_entity_id': _sn_entity_id, 'debug': this.debug}
            })
                .catch((error) => {
                    this.operationInProgress = false
                    showNotyAlert(error.message)
                    if (error.response.status == 419) {
                        this.onCsrfCookieExpiredRequiresAuth()
                    }
                })

            if (response.data.success == true) {
                this.getCurrentVisitorFiles();
            } else {
                showNotyAlert(response.data.message)
            }
        },

        async uploadFile() {
            console.log('add1')
            file = document.getElementById('image').files[0]
            this.file_upload_result = '⌛'

            if (! this.can_upload_files) {
                showNotyAlert('You cannot upload anymore files. Additional files will be rejected by peers.')
                return
            }

            if (!file) {
                showNotyAlert('Please select an image')
                return
            }

            if (this.file_size > this.clientConfig.post_max_size_bytes || this.file_size > this.clientConfig.upload_max_filesize_bytes) {
                showNotyAlert('File to big for your client. Max post: ' + this.clientConfig.post_max_size
                    + '. Max upload: ' + this.clientConfig.upload_max_filesize)
                return
            }

            var formData = new FormData();
            formData.append('type', "multipart/form-data");
            file = document.getElementById('image').files[0]
            formData.append('uploaded_file', file);
            this.operationInProgress = true
            response = await axios({
                url: this.siteRoot + "site_api/v1/visitor_file_upload",
                method: "POST",
                headers: { "Content-Type": undefined },
                data: formData,
            })
                .catch((error) => {
                    this.operationInProgress = false
                    showNotyAlert(error.message)
                    if (error.response.status == 419) {
                        this.onCsrfCookieExpiredRequiresAuth()
                    } else if (error.response.status == 413) {
                        this.operationInProgress = false
                        showNotyAlert('413 Content Too Large')
                    } else {
                        this.file_upload_result = response.data.message
                    }
                })

            this.operationInProgress = false
            if (response.data.success == true) {
                this.file_upload_result = response.data
                this.resetPreview()
                this.getCurrentVisitorFiles()
            } else {
                this.file_upload_result = response.data.message
            }
        },

        

        resetPreview() {
            this.file_size = 0
            document.getElementById('image_preview').src = './img/baseline_image_white_48dp.png'
            document.getElementById('image').value = null
        },

        onImgFileLoaded() {
            document.getElementById('image_preview').src = './img/baseline_access_time_black_48dp.png'
            this.file_upload_result = null
            var selectedFile = document.getElementById('image').files[0]
            var fileReader = new FileReader()
            fileReader.onloadend = (e) => {
                document.getElementById('image_preview').src = './img/baseline_image_white_48dp.png'
                showNotyAlert('Ready to upload');
                var result = event.target.result;
                this.file_size = result.length

                if (this.file_size > this.clientConfig.post_max_size_bytes || this.file_size > this.clientConfig.upload_max_filesize_bytes) {
                    showNotyAlert('File to big for your client. Max post: ' + this.clientConfig.post_max_size
                        + '. Max upload: ' + this.clientConfig.upload_max_filesize)
                    return
                }

                function beginResize(imageString) {
                    fillImage(imageString)
                        .then(resizeOnCanva)
                        .catch(() => { });
                }

                function fillImage(imageString) {
                    return new Promise((resolve, reject) => {
                        const image = new Image();

                        image.onload = function () {
                            resolve(image);
                        };

                        image.onerror = function () {
                            reject(new Error("Failed to load image: " + imageString));
                        };

                        image.src = imageString;
                    });
                }

                var resizeOnCanva = function (image) {
                    var mainCanvas = document.createElement("canvas")
                    mainCanvas.width = 1024
                    mainCanvas.height = 768
                    mainCanvas.getContext("2d").drawImage(image, 0, 0, mainCanvas.width, mainCanvas.height)

                    while (mainCanvas.width > 350) {
                        mainCanvas = getHalfSizedCanva(mainCanvas)
                    }

                    var dataUrl = mainCanvas.toDataURL("image/jpeg")

                    document.getElementById('image_preview').src = dataUrl
                }

                var getHalfSizedCanva = function (img) {
                    var halfCanvas = document.createElement("canvas")
                    halfCanvas.width = img.width / 2
                    halfCanvas.height = img.height / 2
                    halfCanvas.getContext("2d").drawImage(img, 0, 0, halfCanvas.width, halfCanvas.height)
                    return halfCanvas
                }

                beginResize('data:image/jpeg;base64,' + btoa(result))
            };

            fileReader.readAsBinaryString(selectedFile)
        },


        //----------- End regular app


        //----------- Start of Dev methods
        async populateLocalDb() {
            console.log('populateLocalDb')

            date = new Date()
            this.sampleRecords = null
            this.sampleRecords = [
                { title: 'Post title 1', body: 'Lorem ipsum', pinned: true },
                { title: 'Post title 2', body: 'dolor sit amet', pinned: true },
                { title: 'Post title 3', body: 'consectetur adipiscing', pinned: false },
                { title: 'Post title 4', body: 'elit, sed do', pinned: true },
                { title: 'Post title 5', body: 'eiusmod tempor', pinned: true },
            ]

            this.sampleRecords.forEach(element => {
                element._sn_table = 'posts'
            })

            this.populateLocalDbButtonDisabled = false

            /* Optionally parallel  */
            for (let index = 0; index < this.maximumPopulateCount; index++) {
                await new Promise(r => setTimeout(r, this.delay));
                if (!this.populateOn)
                    break

                this.title = 'title'
                this.body = 'body'
                sampleIndex = index < 5 ? index : 0
                if (this.parallel) {
                    this.postRecord(this.sampleRecords[sampleIndex])
                } else {
                    await this.postRecord(this.sampleRecords[sampleIndex])
                }
            }
        },
        batchUploadFiles() {
            files = Array.from(document.getElementById('image').files)

            files.forEach(async function (file) {
                var formData = new FormData();
                formData.append('type', "multipart/form-data");
                formData.append('uploaded_file', file);
                response = await axios({
                    url: this.siteRoot + "site_api/v1/visitor_file_upload",
                    method: "POST",
                    headers: { "Content-Type": undefined },
                    data: formData,
                })
                    .catch((error) => {
                        this.operationInProgress = false
                        showNotyAlert(error.message)
                        if (error.response.status == 419) {
                            this.onCsrfCookieExpiredRequiresAuth()
                        } else {
                            this.file_upload_result = response.data.message
                        }
                    })
                console.log(response.data)
                if (response.data.success == true) {
                    this.file_upload_result = response.data
                    this.resetPreview()
                    this.getCurrentVisitorFiles()

                    showNotyAlert('Uploaded ' + file.name)

                } else {
                    this.file_upload_result = response.data.message
                }
            })
        },

        //----------- End of Dev methods


    }
}).mount('#TechDemoApp')

//---- End of Vue app
enabled = true
if (window.EventSource !== undefined && enabled) {
    var es = new EventSource("/site_api/v1/sse_stream");

    es.addEventListener("message", function (e) {

        var data = JSON.parse(e.data);
        var type;
        console.log(data)

        const map = {
            "created_visitor_record": "success",
            "updated_visitor_record": "alert",
            "deleted_visitor_record": "error",
            "created_visitor_resource": "success",
            "updated_visitor_resource": "alert",
            "deleted_visitor_resource": "error",
            "created_site_definition": "success"
        };
        type = map[data.type]

        if (data.message) {
            document.getElementById('events_box').innerHTML += data.type + '<br />'
            document.getElementById('events_box').innerHTML += data.message.substring(0, 30) + '...' + '<br />'
            document.getElementById('events_box').innerHTML += '<hr />'
            new Noty({
                text: data.type + ' ' + data.message.substring(0, 30) + '...' + '<br><small>' + data.time + '</small>',
                type: type,
                theme: "metroui",
                closeWith: ['click', 'button'],
                layout: "bottomRight",
                timeout: 5000
            }).show();
        }

    }, false);

    es.addEventListener("error", event => {
        if (event.readyState == EventSource.CLOSED) {
            console.log("SSE Connection Closed.");
        }
    }, false);

}
