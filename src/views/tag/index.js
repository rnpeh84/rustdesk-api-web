import { reactive, ref } from 'vue'
import { create as admin_create, list as admin_list, remove as admin_remove, update as admin_update } from '@/api/tag'
import { create as my_create, list as my_list, remove as my_remove, update as my_update } from '@/api/my/tag'
import { ElMessage } from 'element-plus'
import { useRoute } from 'vue-router'
import { T } from '@/utils/i18n'
import { cssToFlutterColor, flutterColorToCss } from '@/utils/tagColor'
import { useRepositories as useCollectionRepositories } from '@/views/address_book/collection'

const apis = {
  admin: { list: admin_list, remove: admin_remove, update: admin_update, create: admin_create },
  my: { list: my_list, remove: my_remove, create: my_create, update: my_update },
}

export function useRepositories (api_type = 'my') {

  //获取query
  const route = useRoute()
  const user_id = route.query?.user_id
  const listRes = reactive({
    list: [], total: 0, loading: false,
  })
  const listQuery = reactive({
    page: 1,
    page_size: 10,
    user_id: user_id ? parseInt(user_id) : null,
    collection_id: null,
  })

  const getList = async () => {
    listRes.loading = true
    const res = await apis[api_type].list(listQuery).catch(_ => false)
    listRes.loading = false
    if (res) {
      listRes.list = res.data.list.map(item => {
        item.color = flutterColorToCss(item.color)
        return item
      })
      listRes.total = res.data.total
    }
  }
  const handlerQuery = () => {
    if (listQuery.page === 1) {
      getList()
    } else {
      listQuery.page = 1
    }
  }

  const del = async (row) => {
    const res = await apis[api_type].remove({ id: row.id }).catch(_ => false)
    if (res) {
      ElMessage.success(T('OperationSuccess'))
      getList()
    }
  }

  const formVisible = ref(false)
  const submitting = ref(false)
  const formData = reactive({
    id: 0,
    name: '',
    color: 0,
    user_id: null,
    collection_id: null,
  })
  const currentColor = ref('')
  const activeChange = (c) => {
    currentColor.value = c
  }
  const toEdit = (row) => {
    formVisible.value = true
    formData.id = row.id
    formData.name = row.name
    formData.color = row.color
    currentColor.value = row.color
    formData.user_id = row.user_id
    formData.collection_id = row.collection_id
    collectionListQuery.user_id = row.user_id
    getCollectionList()
  }
  const toAdd = () => {
    formVisible.value = true
    formData.id = 0
    formData.name = ''
    formData.color = ''
    currentColor.value = ''
    formData.user_id = null
    formData.collection_id = listQuery.collection_id ?? 0
  }
  const submit = async () => {
    if (submitting.value) return
    const color = cssToFlutterColor(formData.color)
    if (color === null || color === 0) {
      ElMessage.error(T('PleaseSelectColor'))
      return
    }
    const api = formData.id ? apis[api_type].update : apis[api_type].create
    const data = {
      ...formData,
      color,
      collection_id: formData.collection_id || 0,
    }
    submitting.value = true
    const res = await api(data).catch(_ => false)
    submitting.value = false
    if (res) {
      ElMessage.success(T('OperationSuccess'))
      formVisible.value = false
      getList()
    }
  }

  //query form collection
  const {
    listRes: collectionListRes,
    listQuery: collectionListQuery,
    getList: getCollectionList,
  } = useCollectionRepositories(api_type)
  collectionListQuery.page_size = 9999
  const changeUser = async (val) => {
    formData.collection_id = 0
    if (!val) {
      collectionListRes.list = []
    } else {
      collectionListQuery.user_id = val
      getCollectionList()
    }
  }

  const {
    listRes: collectionListResForUpdate,
    listQuery: collectionListQueryForUpdate,
    getList: getCollectionListForUpdate,
  } = useCollectionRepositories(api_type)
  collectionListQueryForUpdate.page_size = 9999
  //create or update form collection
  const changeUserForUpdate = async (val) => {
    listQuery.collection_id = null
    if (!val) {
      collectionListRes.list = []
    } else {
      collectionListQuery.user_id = val
      getCollectionListForUpdate()
    }
  }
  return {
    listRes,
    listQuery,
    getList,
    handlerQuery,
    del,
    formVisible,
    submitting,
    formData,
    toEdit,
    toAdd,
    submit,
    activeChange,
    currentColor,

    collectionListRes,
    changeUser,
    getCollectionList,

    collectionListResForUpdate,
    changeUserForUpdate,
    getCollectionListForUpdate,

  }
}
