<template>
	<view class="uni-container">
		<view class="uni-header">
			<view class="uni-group">
				<view class="uni-title">包类型</view>
				<view class="uni-sub-title">{{type_valuetotext[formData.type]}}</view>
			</view>
		</view>
		<uni-forms ref="form" :value="formData" validateTrigger="bind">
			<uni-forms-item name="appid" label="AppID" required>
				<uni-easyinput :disabled="true" v-model="formData.appid" trim="both" />
			</uni-forms-item>
			<uni-forms-item name="name" label="应用名称">
				<uni-easyinput :disabled="true" v-model="formData.name" trim="both" />
			</uni-forms-item>
			<uni-forms-item name="title" label="更新标题">
				<uni-easyinput placeholder="更新标题" v-model="formData.title" />
			</uni-forms-item>
			<uni-forms-item name="contents" label="更新内容" required>
				<textarea auto-height style="box-sizing: content-box;"
					@input="binddata('contents', $event.detail.value)" class="uni-textarea-border"
					:value.sync="formData.contents"></textarea>
			</uni-forms-item>
			<uni-forms-item name="platform" label="平台" required>
				<uni-data-checkbox :multiple="isWGT" v-model="formData.platform" :localdata="platformLocaldata" />
			</uni-forms-item>
			<uni-forms-item name="version" label="版本号" required>
				<uni-easyinput v-model="formData.version" placeholder="当前包版本号，必须大于当前线上发行版本号" />
			</uni-forms-item>
			<uni-forms-item v-if="isWGT" name="min_uni_version" label="原生App最低版本" :required="isWGT">
				<uni-easyinput placeholder="原生App最低版本" v-model="formData.min_uni_version" />
				<show-info :content="minUniVersionContent"></show-info>
			</uni-forms-item>
			<uni-forms-item v-if="!isiOS" name="dirty_data" label="上传包">
				<uni-file-picker v-model="appFileList" :file-extname="fileExtname" :disabled="hasPackage"
					returnType="object" file-mediatype="all" limit="1" @success="packageUploadSuccess"
					@delete="packageDelete">
					<button type="primary" size="mini" @click="selectFile">选择文件</button>
				</uni-file-picker>
				<text v-if="hasPackage"
					style="padding-left: 20px;color: #a8a8a8;">{{Number(appFileList.size / 1024 / 1024).toFixed(2)}}M</text>
			</uni-forms-item>
			<uni-forms-item name="url" :label="isiOS ? 'AppStore' : '包地址'" required>
				<uni-easyinput placeholder="可下载安装包地址" v-model="formData.url" />
				<show-info :top="-80" :content="uploadFileContent"></show-info>
			</uni-forms-item>
			<uni-forms-item v-if="isWGT" name="is_silently" label="静默更新">
				<switch @change="binddata('is_silently', $event.detail.value)" :checked="formData.is_silently" />
				<show-info :top="-80" :content="silentlyContent"></show-info>
			</uni-forms-item>
			<uni-forms-item v-if="!isiOS" name="is_mandatory" label="强制更新">
				<switch @change="binddata('is_mandatory', $event.detail.value)" :checked="formData.is_mandatory" />
				<show-info :content="mandatoryContent"></show-info>
			</uni-forms-item>
			<uni-forms-item name="stable_publish" label="上线发行">
				<switch @change="binddata('stable_publish', $event.detail.value)" :checked="formData.stable_publish" />
				<show-info :top="-40" :content="stablePublishContent2"></show-info>
			</uni-forms-item>
			<uni-forms-item v-show="false" name="type" label="安装包类型">
				<uni-data-checkbox v-model="formData.type" :localdata="formOptions.type_localdata" />
			</uni-forms-item>
			<view class="uni-button-group">
				<button type="primary" class="uni-button" style="width: 100px;" @click="submit">发布</button>
				<button type="warn" class="uni-button" style="width: 100px;margin-left: 15px;" @click="back">取消</button>
			</view>
		</uni-forms>
	</view>
</template>

<script>
	import {
		validator,
		enumConverter
	} from '@/uni_modules/uni-upgrade-center/js_sdk/validator/opendb-app-versions.js';
	import showInfo from '../components/show-info.vue'
	import addAndDetail, {
		fields
	} from '../mixin/version_add_detail_mixin.js';
	import {
		appVersionListDbName
	} from '../utils.js';

	const db = uniCloud.database();
	const dbCmd = db.command;
	const dbCollectionName = appVersionListDbName;

	const platform_iOS = 'iOS';
	const platform_Android = 'Android';

	/**
	 * 对比版本号，如需要，请自行修改判断规则
	 * 支持比对	("3.0.0.0.0.1.0.1", "3.0.0.0.0.1")	("3.0.0.1", "3.0")	("3.1.1", "3.1.1.1") 之类的
	 * @param {Object} v1
	 * @param {Object} v2
	 * v1 > v2 return 1
	 * v1 < v2 return -1
	 * v1 == v2 return 0
	 */
	function compare(v1 = '0', v2 = '0') {
		v1 = String(v1).split('.')
		v2 = String(v2).split('.')
		const minVersionLens = Math.min(v1.length, v2.length);

		let result = 0;
		for (let i = 0; i < minVersionLens; i++) {
			const curV1 = Number(v1[i])
			const curV2 = Number(v2[i])

			if (curV1 > curV2) {
				result = 1
				break;
			} else if (curV1 < curV2) {
				result = -1
				break;
			}
		}

		if (result === 0 && (v1.length !== v2.length)) {
			const v1BiggerThenv2 = v1.length > v2.length;
			const maxLensVersion = v1BiggerThenv2 ? v1 : v2;
			for (let i = minVersionLens; i < maxLensVersion.length; i++) {
				const curVersion = Number(maxLensVersion[i])
				if (curVersion > 0) {
					v1BiggerThenv2 ? result = 1 : result = -1
					break;
				}
			}
		}

		return result;
	}

	export default {
		components: {
			showInfo
		},
		mixins: [addAndDetail],
		data() {
			return {
				latestVersion: '0.0.0',
				lastVersionId: ''
			}
		},
		async onLoad({
			appid,
			name,
			type
		}) {
			if (appid && type && name) {
				this.formData = {
					...this.formData,
					...{
						appid,
						name,
						type
					}
				}

				this.latestStableData = await this.getDetail(appid, type)
				// 如果有数据，否则为发布第一版
				if (!this.isWGT && this.latestStableData.length) {
					this.setFormData(platform_Android)
				}
				// 如果是wgt ，则需要将 min_uni_version 设为必填
				if (this.isWGT) {
					this.rules.min_uni_version.rules.push({
						"required": true
					})
				}
			}
		},
		watch: {
			isiOS(val) {
				if (val) {
					this.setFormData(platform_iOS)
					return;
				} else if (this.hasPackage) {
					this.formData.url = this.appFileList.url
					return;
				}
				this.formData.url = ''
			},
			"formData.platform"(val) {
				// wgt热更新数据渲染
				if (this.isWGT) {
					this.setFormData(val)
				}
			}
		},
		methods: {
			setFormData(os) {
				// 每次需初始化 版本 与 id ，因为可能是新增第一版
				this.latestVersion = '0.0.0';
				this.lastVersionId = ''

				const data = this.getData(this.latestStableData, os)[0]

				if (data) {
					const {
						_id,
						version,
						name,
						platform,
						min_uni_version,
						url
					} = data

					this.lastVersionId = _id
					this.latestVersion = version;

					this.formData.name = name

					// 如果不是wgt，则需要删除 min_uni_version 字段
					if (!this.isWGT) {
						delete this.formData.min_uni_version;
						this.formData.platform = platform[0]

						// iOS需要带出上一版本的AppStore链接
						if (this.isiOS) {
							this.formData.url = url;
						}
					} else {
						this.formData.min_uni_version = min_uni_version
						// this.formData.platform = [os]
					}
				} else if (this.isWGT) {
					this.formData.min_uni_version = ''
				}
			},
			/**
			 * 触发表单提交
			 */
			submit() {
				uni.showLoading({
					mask: true
				})
				this.$refs.form.submit().then((res) => {
					if (compare(this.latestVersion, res.version) >= 0) {
						uni.showModal({
							content: `版本号必须大于当前已上线版本（${this.latestVersion}）`,
							showCancel: false
						})
						throw new Error('版本号必须大于已上线版本（${this.latestVersion}）');
						return;
					}
					// 如果不是 wgt 更新，则需将 platform 字段还原为 array
					if (!this.isWGT) {
						res.platform = [res.platform]
					}
					// 删除多余字段
					delete res.dirty_data
					this.submitForm(res)
				}).catch((errors) => {
					uni.hideLoading()
				})
			},
			async submitForm(value) {
				const collectionDB = db.collection(dbCollectionName)
				// 使用 clientDB 提交数据
				collectionDB.add(value).then(async (res) => {
					// 如果新增版本为上线发行，且之前有该平台的上线发行，则自动将上一版设为下线
					if (value.stable_publish && this.lastVersionId) {
						await collectionDB.doc(this.lastVersionId).update({
							stable_publish: false
						})
					}
					uni.showToast({
						title: '新增成功'
					})
					this.getOpenerEventChannel().emit('refreshData')
					setTimeout(() => uni.navigateBack(), 500)
				}).catch((err) => {
					uni.showModal({
						content: err.message || '请求服务失败',
						showCancel: false
					})
				}).finally(() => {
					uni.hideLoading()
				})
			},
			/**
			 * 获取表单数据
			 * @param {Object} id
			 */
			getDetail(appid, type) {
				uni.showLoading({
					mask: true
				})
				return db.collection(dbCollectionName).where({
					appid,
					type,
					stable_publish: true
				}).field(fields).get().then((
					res) => {
					return res.result.data
				}).catch((err) => {
					uni.showModal({
						content: err.message || '请求服务失败',
						showCancel: false
					})
				}).finally(() => {
					uni.hideLoading()
				})
			},
			getData(data = [], platform) {
				if (typeof platform === 'string') {
					return data.filter(item => item.platform.includes(platform))
				} else {
					return data.filter(item => item.platform.toString() === platform.toString())
				}
			},
			back() {
				uni.showModal({
					title: '取消发布',
					content: this.hasPackage ? '将会删除已上传的包' : '',
					success: res => {
						if (res.confirm) {
							// 若已上传包但取消发布，则自动将包删除
							if (this.hasPackage) {
								let fileList = [];
								fileList.push(this.appFileList.url)
								this.$request('deleteFile', {
									fileList
								}, {
									functionName: 'upgrade-center'
								})
							}

							uni.navigateBack()
						}
					}
				});
			}
		}
	}
</script>

<style lang="scss">
	/deep/ .uni-forms-item__content {
		display: flex;
		align-items: center;
	}
</style>
