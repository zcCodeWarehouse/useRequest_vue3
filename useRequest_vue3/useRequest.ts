/*
 * @Description:  useRequest 1.2 -vue3
 * @Author: ZC
 * @Date: 2021-06-24 14:23:38
 * @LastEditors: ZC
 * @LastEditTime: 2021-06-25 16:43:01
 */
import axios from 'axios'
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
/** 传参 */
interface UseRequestOption<P, R> {
	/** 默认请求传参 */
	defaultParams?: P
	/** 是否手动触发 */
	manual?: boolean
	/** 是否开启分页模式 */
	paginated?: boolean
	/** loading延迟 防止闪烁 */
	loadingDelay?: number
	/** 成功回调 */
	onSuccess?: (data: R, params?: P) => void
	/** 失败回调 */
	onError?: (error: any) => void
	/** 并行请求key 一般为Id */
	dataKey?: string
}
/** 并行请求返回值 */
interface Data<R> {
	loading: boolean
	data: R | null
	error: any
}
/** 考虑到key为数字 */
interface DataMap<R> {
	[key: string]: Data<R>
	[key: number]: Data<R>
}
/** axios post请求 */
const post = async (url: string, params?: any): Promise<[any, any]> => {
	return new Promise((resolve, reject) => {
		axios.post(url, params)
			.then((res: any) => {
				resolve([res.data, null])
			})
			.catch((err: any) => {
				resolve([null, err])
			})
	})
}
/** start */
const useRequest = <P = any, R = any>(url: string, option?: UseRequestOption<P, R>) => {
	// 初始化参数
	const { defaultParams, onSuccess, onError, dataKey, loadingDelay = 0, paginated } = option || {}
	const manual = dataKey ? true : option?.manual
	// 初始化响应式数据
	const loading = ref(false)
	const data = ref<R | null>(null)
	const dataMap = reactive<DataMap<R>>({})
	const error = ref<any>(null)
	const pagination = reactive({
		pageSize: 10,
		pageNo: 1,
		total: 0,
		onChange: (pageNo?: number, pageSize?: number) => {
			run({ ...paginationParams, pageNo, pageSize })
		}
	})
	// 初始化一个对象 保存分页请求的业务部分传参
	let paginationParams: any = {}
	// 初始化请求函数
	let run = async (params?: P, callback?: Function) => { }
	// 并行请求
	if (dataKey) {
		// dataMap用来保存对应key的数据 
		run = async (params, callback?: Function) => {
			const key = params ? (params as any)[dataKey] : null
			dataMap[key] = { loading: true, data: null, error: null }
			const [result, err] = await request(params)
			dataMap[key] = { loading: false, data: err || result, error: err }
			if (err) {
				errMessage(err)
				onError && onError(err)
				return
			}
			onSuccess && onSuccess(result, params)
			callback && callback(result, params)
		}
	} else { // 非并行请求
		run = async (params = defaultParams, callback?: Function) => {
			loading.value = true
			const [result, err] = await request(params || {})
			loading.value = false
			if (err) {
				error.value = err
				errMessage(err)
				onError && onError(err)
				return
			}
			// 分页请求
			if (paginated) {
				paginationParams = params
				// 只获取业务参数
				delete paginationParams.pageNo
				delete paginationParams.pageSize
				// 分页请求返回值一般会在result里
				data.value = result.result
				const { pageSize, pageNo } = params as any
				pagination.pageSize = pageSize
				pagination.pageNo = pageNo
				pagination.total = result.total
				onSuccess && onSuccess(result.result, paginationParams)
			} else {
				data.value = result
				onSuccess && onSuccess(result, params)
				callback && callback(result, params)
			}
		}
	}
	// init
	onMounted(() => {
		if (!manual && dataKey) throw new Error('并行请求不能自动触发 manual应为true')
		if (paginated && dataKey) throw new Error('并行请求不能开启分页 paginated应为false')
		if (manual) return
		const options: any = paginated ? { ...defaultParams, pageNo: pagination.pageNo, pageSize: pagination.pageSize } : defaultParams
		run(options)
	})
	/** 网络请求 loadingDelay延迟返回结果 */
	const request: Function = (async (params?: P) => {
		const [result, err] = await post(url, params)
		return new Promise((resolve) => {
			setTimeout(() => {
				resolve([result, err])
			}, loadingDelay)
		})
	})
	// 错误弹窗 根据使用的UI框架决定
	const errMessage = (err: any) => {
		let message
		if (err.message.includes('404')) {
			message = '网络请求失败'
		}
		if (err.message.includes('500')) {
			message = err.response.data.message || '系统异常，请联系管理员。'
		}
		ElMessage({
			message,
			type: 'error',
			duration: 2000
		})
	}
	if (paginated) return { data, dataMap, loading, error, pagination, run }
	return { data, loading, dataMap, error, run }
}

export default useRequest