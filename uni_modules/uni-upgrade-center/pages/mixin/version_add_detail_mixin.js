import {
	validator,
	enumConverter
} from '@/uni_modules/uni-upgrade-center/js_sdk/validator/opendb-app-versions.js';

const platform_iOS = 'iOS';
const platform_Android = 'Android';

function getValidator(fields) {
	let reuslt = {}
	for (let key in validator) {
		if (fields.includes(key)) {
			reuslt[key] = validator[key]
		}
	}
	return reuslt
}

export const fields =
	'appid,name,title,contents,platform,type,version,min_uni_version,url,stable_publish,is_silently,is_mandatory'

export default {
	data() {
		return {
			enableiOSWgt: true,	// 是否开启iOS的wgt更新
			silentlyContent: '静默更新：App升级时会在后台下载wgt包并自行安装。新功能在下次启动App时生效',
			mandatoryContent: '强制更新：App升级弹出框不可取消',
			stablePublishContent: '同时只可有一个线上发行版，线上发行不可更设为下线。\n未上线可以设为上线发行并自动替换当前线上发行版',
			stablePublishContent2: '使用本包替换当前线上发行版',
			uploadFileContent: '可下载安装包地址。上传文件到云存储自动填写，也可以手动填写',
			minUniVersionContent: '上次使用新Api或打包新模块的App版本',
			latestStableData: [], // 库中最新已上线版
			appFileList: null, // 上传包
			type_valuetotext: enumConverter.type_valuetotext,
			preUrl: '',
			formData: {
				"appid": "",
				"name": "",
				"title": "",
				"contents": "",
				"platform": [],
				"type": "",
				"version": "",
				"min_uni_version": "",
				"url": "",
				"stable_publish": false,
				"create_date": null
			},
			formOptions: {
				"platform_localdata": [{
						"value": "Android",
						"text": "安卓"
					},
					{
						"value": "iOS",
						"text": "苹果"
					}
				],
				"type_localdata": [{
						"value": "native_app",
						"text": "原生App安装包"
					},
					{
						"value": "wgt",
						"text": "App资源包"
					}
				]
			},
			rules: {
				...getValidator(["appid", "contents", "platform", "type", "version", "min_uni_version", "url",
					"stable_publish",
					"title", "name", "is_silently", "is_mandatory"
				])
			}
		}
	},
	onReady() {
		this.$refs.form.setRules(this.rules)
	},
	computed: {
		isWGT() {
			return this.formData.type === 'wgt'
		},
		isiOS() {
			return !this.isWGT ? this.formData.platform.includes(platform_iOS) : false;
		},
		hasPackage() {
			return this.appFileList && !!Object.keys(this.appFileList).length
		},
		fileExtname() {
			return this.isWGT ? ['wgt'] : ['apk']
		},
		platformLocaldata() {
			return !this.isWGT ? this.formOptions.platform_localdata : this.enableiOSWgt ? this.formOptions.platform_localdata : [this.formOptions.platform_localdata[0]]
		}
	},
	methods: {
		packageUploadSuccess(res) {
			uni.showToast({
				icon: 'success',
				title: '上传成功',
				duration: 800
			})
			this.preUrl = this.formData.url
			this.formData.url = res.tempFilePaths[0]
		},
		async packageDelete(res) {
			if (!this.hasPackage) return;
			let [deleteRes] = await this.$request('deleteFile', {
				fileList: [res.tempFilePath]
			}, {
				functionName: 'upgrade-center'
			})
			if (deleteRes.success) {
				uni.showToast({
					icon: 'success',
					title: '删除成功',
					duration: 800
				})
				this.formData.url = this.preUrl
				this.$refs.form.clearValidate('url')
			}
		},
		selectFile() {
			if (this.hasPackage) {
				uni.showToast({
					icon: 'none',
					title: '只可上传一个文件，请删除已上传后重试',
					duration: 1000
				});
			}
		}
	}
}
