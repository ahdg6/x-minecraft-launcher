import { computed, onMounted, reactive, Ref, toRefs, watch } from '@vue/composition-api'
import { MinecraftVersion } from '@xmcl/installer'
import { useBusy } from './useSemaphore'
import { useService, useServiceOnly } from './useService'
import { filterOptfineVersion, isFabricLoaderLibrary, isForgeLibrary, isOptifineLibrary, Status } from '/@shared/entities/version'
import { InstallServiceKey } from '/@shared/services/InstallService'
import { VersionServiceKey } from '/@shared/services/VersionService'
import { isNonnull } from '/@shared/util/assert'

export function useVersions() {
  return useServiceOnly(VersionServiceKey, 'deleteVersion', 'refreshVersion', 'refreshVersions', 'showVersionDirectory', 'showVersionsDirectory')
}

export function useInstallService() {
  return useService(InstallServiceKey)
}

export function useVersionService() {
  return useService(VersionServiceKey)
}

export function useLocalVersions() {
  const { state } = useVersionService()
  const localVersions = computed(() => state.local)
  const versions = useVersions()

  onMounted(() => {
    versions.refreshVersions()
  })

  return {
    localVersions,
    ...versions,
    ...useServiceOnly(InstallServiceKey, 'reinstall'),
  }
}

export function useMinecraftVersions() {
  const { state } = useVersionService()
  const { state: installState, refreshMinecraft, installMinecraft } = useInstallService()
  const refreshing = useBusy('refreshMinecraft()')
  const versions = computed(() => installState.minecraft.versions)
  const release = computed(() => installState.minecraft.versions.find(v => v.id === installState.minecraft.latest.release))
  const snapshot = computed(() => installState.minecraft.versions.find(v => v.id === installState.minecraft.latest.snapshot))

  const statuses = computed(() => {
    const localVersions: { [k: string]: boolean } = {}
    state.local.forEach((ver) => {
      if (ver.minecraftVersion) localVersions[ver.minecraftVersion] = true
    })
    const statusMap: { [key: string]: Status } = {}
    for (const ver of installState.minecraft.versions) {
      statusMap[ver.id] = localVersions[ver.id] ? 'local' : 'remote'
    }
    return statusMap
  })

  const v = computed(() => installState.minecraft.versions.map(v => reactive({ ...v, status: computed(() => statuses.value[v.id]) })))


  onMounted(() => {
    refreshMinecraft()
  })

  return {
    statuses,
    versions,
    refreshing,
    release,
    snapshot,
    install: installMinecraft,
    refresh: refreshMinecraft,
  }
}

export function useMinecraftVersionFilter(filterText: Ref<string>) {
  const data = reactive({
    acceptingRange: '',
    showAlpha: false,
  })

  function filter(v: MinecraftVersion) {
    if (!data.showAlpha && v.type !== 'release') return false
    // if (!isCompatible(data.acceptingRange, v.id)) return false;
    return v.id.indexOf(filterText.value) !== -1
  }

  return {
    ...toRefs(data),
    filter,
  }
}

export function useFabricVersions() {
  const { state: installState, refreshFabric, installFabric } = useInstallService()
  const { state } = useVersionService()
  const loaderVersions = computed(() => installState.fabric.loaders ?? [])
  const yarnVersions = computed(() => installState.fabric.yarns ?? [])
  const loaderStatus = computed(() => {
    const statusMap: { [key: string]: Status } = {}
    const locals: { [k: string]: boolean } = {}
    state.local.forEach((ver) => {
      const lib = ver.libraries.find(isFabricLoaderLibrary)
      if (lib) locals[lib.version] = true
    })
    installState.fabric.loaders.forEach((v) => {
      statusMap[v.version] = locals[v.version] ? 'local' : 'remote'
    })
    return statusMap
  })
  const yarnStatus = computed(() => {
    const statusMap: { [key: string]: Status } = {}
    const locals: { [k: string]: boolean } = {}
    // installState.local.forEach((ver) => {
    //     if (ver.yarn) locals[ver.yarn] = true;
    // });
    installState.fabric.yarns.forEach((v) => {
      statusMap[v.version] = locals[v.version] ? 'local' : 'remote'
    })
    return statusMap
  })

  function refresh(force = false) {
    return refreshFabric(force)
  }

  onMounted(() => {
    refresh()
  })

  return {
    loaderVersions,
    yarnVersions,
    install: installFabric,
    refresh,
    loaderStatus,
    yarnStatus,
  }
}

export function useForgeVersions(minecraftVersion: Ref<string>) {
  const { state: installState, refreshForge, installForge } = useInstallService()
  const { state } = useVersionService()
  const versions = computed(() => installState.forge.find(v => v.mcversion === minecraftVersion.value)?.versions ?? [])
  const refreshing = useBusy('refreshForge()')

  const recommended = computed(() => {
    const vers = versions.value
    if (!vers) return undefined
    return vers.find(v => v.type === 'recommended')
  })
  const latest = computed(() => {
    const vers = versions.value
    if (!vers) return undefined
    return vers.find(v => v.type === 'latest')
  })
  const statuses = computed(() => {
    const statusMap: { [key: string]: Status } = {}
    const localForgeVersion: { [k: string]: boolean } = {}
    state.local.forEach((ver) => {
      const lib = ver.libraries.find(isForgeLibrary)
      if (lib) localForgeVersion[lib.version] = true
    })
    installState.forge.forEach((container) => {
      container.versions.forEach((version) => {
        statusMap[version.version] = localForgeVersion[version.version] ? 'local' : 'remote'
      })
    })
    console.log(statusMap)
    return statusMap
  })

  onMounted(() => {
    watch(minecraftVersion, () => {
      if (versions.value.length === 0) {
        refreshForge({ mcversion: minecraftVersion.value })
      }
    })
    refreshForge({ mcversion: minecraftVersion.value })
  })

  function refresh() {
    return refreshForge({ mcversion: minecraftVersion.value, force: true })
  }

  return {
    versions,
    refresh,
    refreshing,
    statuses,
    recommended,
    install: installForge,
    latest,
  }
}

export function useLiteloaderVersions(minecraftVersion: Ref<string>) {
  const { state: installState, refreshLiteloader } = useInstallService()
  const { state } = useVersionService()

  const versions = computed(() => Object.values(installState.liteloader.versions[minecraftVersion.value] || {}).filter(isNonnull))
  const refreshing = useBusy('refreshLiteloader')
  onMounted(() => {
    watch(minecraftVersion, () => {
      if (!versions.value) {
        refreshLiteloader()
      }
    })
  })

  function refresh() {
    return refreshLiteloader()
  }

  return {
    versions,
    refresh,
    refreshing,
  }
}

export function useOptifineVersions(minecraftVersion: Ref<string>) {
  const { state: installState, refreshOptifine, installOptifine } = useInstallService()
  const { state } = useVersionService()

  const versions = computed(() => installState.optifine.versions.filter(v => v.mcversion === minecraftVersion.value))
  const refreshing = useBusy('refreshOptifine()')

  const statuses = computed(() => {
    const localVersions: { [k: string]: boolean } = {}
    state.local.forEach((ver) => {
      const lib = ver.libraries.find(isOptifineLibrary)
      if (lib) {
        const optifineVer = filterOptfineVersion(lib?.version)
        localVersions[`${ver.minecraftVersion}_${optifineVer}`] = true
      }
    })
    const statusMap: { [key: string]: Status } = {}
    for (const ver of installState.optifine.versions) {
      const optifineVersion = ver.mcversion + '_' + ver.type + '_' + ver.patch
      statusMap[optifineVersion] = localVersions[optifineVersion] ? 'local' : 'remote'
    }
    return statusMap
  })

  watch(minecraftVersion, () => {
    refreshOptifine()
  })

  function refresh() {
    return refreshOptifine()
  }

  return {
    statuses,
    versions,
    refresh,
    refreshing,
    install: installOptifine,
  }
}
