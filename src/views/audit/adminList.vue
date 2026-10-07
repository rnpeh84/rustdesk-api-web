<template>
  <div>
    <QueryToolbar class="list-query" shadow="never" :query="query" fields="resource,result" @query="search"><el-form inline @keyup.enter="search"><el-form-item :label="T('Resource')"><el-input v-model="query.resource" clearable class="query-search-field" :placeholder="T('Resource')" :aria-label="T('Resource')" /></el-form-item><el-form-item :label="T('Result')"><el-select v-model="query.result" clearable><el-option :label="T('Success')" value="success" /><el-option :label="T('Failure')" value="failure" /><el-option :label="T('Denied')" value="denied" /></el-select></el-form-item><el-form-item><el-button class="query-submit" type="primary" @click="search">{{ T('Filter') }}</el-button></el-form-item></el-form></QueryToolbar>
    <el-card class="list-body" shadow="never"><el-table :data="result.list" v-loading="result.loading" border scrollbar-always-on><el-table-column prop="id" label="ID" width="80" fixed="left" /><el-table-column prop="actor_name" :label="T('Actor')" min-width="130" /><el-table-column prop="resource" :label="T('Resource')" min-width="130" /><el-table-column prop="action" :label="T('Action')" width="110" /><el-table-column prop="target" :label="T('Target')" min-width="100" /><el-table-column prop="result" :label="T('Result')" width="100"><template #default="{ row }"><el-tag :type="row.result === 'success' ? 'success' : 'danger'">{{ row.result }}</el-tag></template></el-table-column><el-table-column prop="request_id" :label="T('RequestId')" min-width="230" show-overflow-tooltip /><el-table-column prop="summary" :label="T('Summary')" min-width="260" show-overflow-tooltip /><el-table-column prop="created_at" :label="T('CreatedAt')" min-width="170" /></el-table></el-card>
    <el-card class="list-page" shadow="never"><el-pagination v-model:current-page="query.page" v-model:page-size="query.page_size" background layout="prev, pager, next, sizes" :total="result.total" /></el-card>
  </div>
</template>
<script setup>
import QueryToolbar from '@/components/QueryToolbar.vue'
import { onMounted, reactive, watch } from 'vue'
import { list } from '@/api/adminAudit'
import { T } from '@/utils/i18n'
const query = reactive({ page: 1, page_size: 10, resource: '', result: '' })
const result = reactive({ list: [], total: 0, loading: false })
const load = async () => { result.loading = true; const res = await list(query).catch(() => false); result.loading = false; if (res) Object.assign(result, res.data) }
const search = () => { if (query.page === 1) load(); else query.page = 1 }
watch(() => [query.page, query.page_size], load)
onMounted(load)
</script>
