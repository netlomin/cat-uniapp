<template>
	<view class="uni-container">
		<view class="uni-header">
			<view class="uni-group">
				<view class="uni-title">包类型</view>
				<view class="uni-sub-title" style="display: flex;justify-content: center;align-items: center;">
					{{type_valuetotext[formData.type]}}
				</view>
			</view>
			<view v-if="!isStable" class="uni-group">
				<button class="uni-button" type="warn" size="mini" @click="deletePackage">删除</button>
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
				<uni-easyinput :disabled="detailsState" placeholder="更新标题" v-model="formData.title" />
			</uni-forms-item>
			<uni-forms-item name="contents" label="更新内容" required>
				<textarea auto-height style="box-sizing: content-box;" :disabled="detailsState"
					@input="binddata('contents', $event.detail.value)" class="uni-textarea-border"
					:value.sync="formData.contents"></textarea>
			</uni-forms-item>
			<uni-forms-item name="platform" label="平台" required>
				<uni-data-checkbox :disabled="true" :multiple="true" v-model="formData.platform"
					:localdata="platformLocaldata" />
			</uni-forms-item>
			<uni-forms-item name="version" label="版本号" required>
				<uni-easyinput :disabled="true" v-model="formData.version" placeholder="当前包版本号，必须大于当前已上线版本号" />
			</uni-forms-item>
			<uni-forms-item v-if="isWGT" name="min_uni_version" label="原生App最低版本" :required="isWGT">
				<uni-easyinput :disabled="detailsState" placeholder="原生App最低版本" v-model="formData.min_uni_version" />
				<show-info :content="minUniVersionContent"></show-info>
			</uni-forms-item>
			<uni-forms-item v-if="!isiOS && !detailsState" name="dirty_data" label="上传包">
				<uni-file-picker v-model="appFileList" :file-extname="fileExtname" :disabled="hasPackage"
					returnType="object" file-mediatype="all" limit="1" @success="packageUploadSuccess"
					@delete="packageDelete">
					<button type="primary" size="mini" @click="selectFile">选择文件</button>
				</uni-file-picker>
				<text v-if="hasPackage"
					style="padding-left: 20px;color: #a8a8a8;">{{Number(appFileList.size / 1024 / 1024).toFixed(2)}}M</text>
			</uni-forms-item>
			<uni-forms-item name="url" :label="isiOS ? 'AppStore' : '包地址'" required>
				<uni-easyinput :disabled="detailsState" placeholder="可下载安装包地址" v-model="formData.url" />
				<show-info :top="-80" :content="uploadFileContent"></show-info>
			</uni-forms-item>
			<uni-forms-item v-if="isWGT" name="is_silently" label="静默更新">
				<switch :disabled="detailsState" @change="binddata('is_silently', $event.detail.value)"
					:checked="formData.is_silently" />
				<show-info :top="-80" :content="silentlyContent"></show-info>
			</uni-forms-item>
			<uni-forms-item v-if="!isiOS" name="is_mandatory" label="强制更新">
				<switch :disabled="detailsState" @change="binddata('is_mandatory', $event.detail.value)"
					:checked="formData.is_mandatory" />
				<show-info :content="mandatoryContent"></show-info>
			</uni-forms-item>
			<uni-forms-item name="stable_publish" label="上线发行">
				<switch :disabled="detailsState || isStable" @change="binddata('stable_publish', $event.detail.value)"
					:checked="formData.stable_publish" />
				<show-info v-if="isStable" :top="-100" :content="stablePublishContent"></show-info>
				<show-info v-else :top="-40" :content="stablePublishContent2"></show-info>
			</uni-forms-item>
			<uni-forms-item name="create_date" label="上传时间">
				<uni-dateformat format="yyyy-MM-dd hh:mm:ss" :date="formData.create_date" :threshold="[0, 0]" />
			</uni-forms-item>
			<uni-forms-item v-show="false" name="type" label="安装包类型">
				<uni-data-checkbox v-model="formData.type" :localdata="formOptions.type_localdata" />
			</uni-forms-item>
			<view class="uni-button-group">
				<button type="primary" class="uni-button" style="width: 100px;" @click="detailsState = false"
					v-if="detailsState">修改</button>
				<button type="primary" class="uni-button" style="width: 100px;" @click="submit"
					v-if="!detailsState">提交</button>
				<button type="warn" class="uni-button" style="width: 100px;" @click="cancelEdit"
					v-if="!detailsState">取消</button>
				<navigator open-type="navigateBack" style="margin-left: 15px;">
					<button class="uni-button" style="width: 100px;">返回</button>
				</navigator>
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
	} from '../mixin/version_add_detail_mixin.js'
	import {
		deepClone,
		appVersionListDbName
	} from '../utils.js'

	const db = uniCloud.database();
	const dbCmd = db.command;
	const dbCollectionName = appVersionListDbName;

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

	export default {
		components: {
			showInfo
		},
		mixins: [addAndDetail],
		data() {
			return {
				showStableInfo: false,
				isStable: true, // 是否是线上发行版
				originalData: [], // 原始数据，用于恢复状态
				detailsState: true // 查看状态
			}
		},
		async onLoad(e) {
			const id = e.id
			this.formDataId = id
			await this.getDetail(id)
			this.isStable = this.formData.stable_publish;
			this.latestStableData = await this.getLatestVersion();
			if (this.isWGT) {
				this.rules.min_uni_version.rules.push({
					"required": true
				})
			}
		},
		methods: {
			/**
			 * 触发表单提交
			 */
			submit() {
				uni.showLoading({
					mask: true
				})
				this.$refs.form.submit().then((res) => {
					delete res.dirty_data
					this.submitForm(res)
				}).catch((errors) => {
					uni.hideLoading()
				})
			},
			async submitForm(value) {
				const collectionDB = db.collection(dbCollectionName)
				// 使用 clientDB 提交数据
				collectionDB.doc(this.formDataId).update(value).then(async (res) => {
					// 如果不是线上发行版，则在设置为上线发行时，需将之前的已上线版设为下线
					if (!this.isStable && value.stable_publish === true && this.latestStableData) {
						await collectionDB.doc(this.latestStableData._id).update({
							stable_publish: false
						})
					}

					uni.showToast({
						title: '修改成功'
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
			getDetail(id) {
				uni.showLoading({
					mask: true
				})
				return db.collection(dbCollectionName).doc(id).field(fields).get().then((
					res) => {
					const data = res.result.data[0]
					if (data) {
						this.formData = data
						this.originalData = deepClone(this.formData)
					}
				}).catch((err) => {
					uni.showModal({
						content: err.message || '请求服务失败',
						showCancel: false
					})
				}).finally(() => {
					uni.hideLoading()
				})
			},
			deletePackage() {
				uni.showModal({
					title: '提示',
					content: '是否删除该版本',
					success: res => {
						if (res.confirm) {
							uni.showLoading({
								mask: true
							})
							db.collection(dbCollectionName).doc(this.formDataId).remove()
								.then(() => {
									uni.showToast({
										title: '删除成功'
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
						}
					}
				});
			},
			async getLatestVersion() {
				const where = {
					appid: this.formData.appid,
					type: this.formData.type,
					stable_publish: true
				};
				if (!this.isWGT) {
					where.platform = this.formData.platform[0]
				}
				const latestStableData = await db.collection(dbCollectionName).where(where).get()
				return latestStableData.result.data.find(item => item.platform.toString() === this.formData.platform.toString());
			},
			cancelEdit() {
				let content = '';
				!this.isiOS && this.hasPackage ? content += '\n将会删除已上传的包' : '';
				uni.showModal({
					title: '取消修改',
					content,
					success: res => {
						if (res.confirm) {
							this.formData = deepClone(this.originalData)
							this.detailsState = true

							if (this.hasPackage) {
								let fileList = [];
								fileList.push(this.appFileList.url)
								this.$request('deleteFile', {
									fileList
								}, {
									functionName: 'upgrade-center'
								})
							}
						}
					}
				});
			}
		}
	}
</script>
<style lang="scss">
	.show-stable-info {
		position: absolute;
		left: 165px;
		padding: 5px 10px;
		background-color: #f4f4f5;
		color: #909399;
		border-radius: 4px;
		border: 1px solid #e9e9eb;
	}

	/deep/ .uni-forms-item__content {
		display: flex;
		align-items: center;
	}
</style>
