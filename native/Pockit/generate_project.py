#!/usr/bin/env python3
"""Generate the checked-in Xcode project using only Python's standard library."""
from pathlib import Path
import hashlib
import json
import plistlib
root = Path(__file__).resolve().parent
objects = {}
def ident(name): return hashlib.sha1(name.encode()).hexdigest()[:24].upper()
def add(identity, kind, **fields):
    key = ident(identity)
    objects[key] = dict(isa=kind, **fields)
    return key
def ref_file(path, kind): return add('file:'+path, 'PBXFileReference', lastKnownFileType=kind, path=path, sourceTree='<group>')
files = {path:ref_file(path,'sourcecode.swift') for path in ['Shared/PockitSnapshot.swift','App/PockitApp.swift','App/WebContainer.swift','App/PockitIntents.swift','Widget/PockitWidget.swift']}
assets=ref_file('Assets.xcassets','folder.assetcatalog')
products={name:add('product:'+name,'PBXFileReference',explicitFileType=kind,path=path,sourceTree='BUILT_PRODUCTS_DIR') for name,kind,path in [('Pockit','wrapper.application','Pockit.app'),('PockitWidget','wrapper.app-extension','PockitWidget.appex')]}
products_group=add('products','PBXGroup',children=list(products.values()),name='Products',sourceTree='<group>')
main_group=add('main','PBXGroup',children=[*files.values(),assets,products_group],sourceTree='<group>')
common={'SDKROOT':'iphoneos','SUPPORTED_PLATFORMS':'iphoneos iphonesimulator','IPHONEOS_DEPLOYMENT_TARGET':'18.0','SWIFT_VERSION':'5.0','CODE_SIGN_STYLE':'Automatic','TARGETED_DEVICE_FAMILY':'1','POCKIT_APP_GROUP':'group.com.alinikan.pockit','CURRENT_PROJECT_VERSION':'1','MARKETING_VERSION':'1.0','ENABLE_USER_SCRIPT_SANDBOXING':'YES','GENERATE_INFOPLIST_FILE':'NO'}
def configuration(name, extra):
    keys=[]
    for mode in ['Debug','Release']:
        settings=dict(common,**extra,SWIFT_OPTIMIZATION_LEVEL='-Onone' if mode=='Debug' else '-O')
        keys.append(add(f'{name}:{mode}','XCBuildConfiguration',buildSettings=settings,name=mode))
    return add(f'{name}:configs','XCConfigurationList',buildConfigurations=keys,defaultConfigurationIsVisible=0,defaultConfigurationName='Release')
project_configs=configuration('project',{'CLANG_ENABLE_MODULES':'YES'})
targets={name:ident('target:'+name) for name in products}
proxy=add('widget-proxy','PBXContainerItemProxy',containerPortal=ident('project'),proxyType=1,remoteGlobalIDString=targets['PockitWidget'],remoteInfo='PockitWidget')
dependency=add('widget-dependency','PBXTargetDependency',target=targets['PockitWidget'],targetProxy=proxy)
embed_file=add('embed-widget-file','PBXBuildFile',fileRef=products['PockitWidget'],settings={'ATTRIBUTES':['RemoveHeadersOnCopy']})
embed=add('embed-widget','PBXCopyFilesBuildPhase',buildActionMask=2147483647,dstPath='',dstSubfolderSpec=13,files=[embed_file],name='Embed App Extensions',runOnlyForDeploymentPostprocessing=0)
for name in products:
    app=name=='Pockit'
    sources=['Shared/PockitSnapshot.swift']+(['App/PockitApp.swift','App/WebContainer.swift','App/PockitIntents.swift'] if app else ['Widget/PockitWidget.swift'])
    source_files=[add(name+':'+path,'PBXBuildFile',fileRef=files[path]) for path in sources]
    source_phase=add(name+':sources','PBXSourcesBuildPhase',buildActionMask=2147483647,files=source_files,runOnlyForDeploymentPostprocessing=0)
    framework_phase=add(name+':frameworks','PBXFrameworksBuildPhase',buildActionMask=2147483647,files=[],runOnlyForDeploymentPostprocessing=0)
    resources=[add('app-assets','PBXBuildFile',fileRef=assets)] if app else []
    resource_phase=add(name+':resources','PBXResourcesBuildPhase',buildActionMask=2147483647,files=resources,runOnlyForDeploymentPostprocessing=0)
    extra={'PRODUCT_NAME':name,'PRODUCT_BUNDLE_IDENTIFIER':'com.alinikan.pockit' if app else 'com.alinikan.pockit.widget','INFOPLIST_FILE':'App/Info.plist' if app else 'Widget/Info.plist','CODE_SIGN_ENTITLEMENTS':'App/Pockit.entitlements' if app else 'Widget/PockitWidget.entitlements','LD_RUNPATH_SEARCH_PATHS':['$(inherited)','@executable_path/Frameworks'] if app else ['$(inherited)','@executable_path/Frameworks','@executable_path/../../Frameworks']}
    if app: extra['ASSETCATALOG_COMPILER_APPICON_NAME']='AppIcon'
    else: extra.update(APPLICATION_EXTENSION_API_ONLY='YES',SKIP_INSTALL='YES')
    add('target:'+name,'PBXNativeTarget',buildConfigurationList=configuration(name,extra),buildPhases=[source_phase,framework_phase,resource_phase]+([embed] if app else []),buildRules=[],dependencies=[dependency] if app else [],name=name,productName=name,productReference=products[name],productType='com.apple.product-type.application' if app else 'com.apple.product-type.app-extension')
add('project','PBXProject',attributes={'LastUpgradeCheck':'2700','BuildIndependentTargetsInParallel':'YES'},buildConfigurationList=project_configs,compatibilityVersion='Xcode 14.0',developmentRegion='en',hasScannedForEncodings=0,knownRegions=['en','Base'],mainGroup=main_group,productRefGroup=products_group,projectDirPath='',projectRoot='',targets=list(targets.values()))
def fmt(value,level=0):
    if isinstance(value,dict): return '{\n'+''.join('\t'*(level+1)+json.dumps(k)+' = '+fmt(v,level+1)+';\n' for k,v in value.items())+'\t'*level+'}'
    if isinstance(value,list): return '(\n'+''.join('\t'*(level+1)+fmt(v,level+1)+',\n' for v in value)+'\t'*level+')'
    if isinstance(value,int): return str(value)
    return json.dumps(value)
project=root/'Pockit.xcodeproj'
project.mkdir(exist_ok=True)
(project/'project.pbxproj').write_text('// !$*UTF8*$!\n'+fmt({'archiveVersion':1,'classes':{},'objectVersion':56,'objects':objects,'rootObject':ident('project')})+'\n')
base={'CFBundleDevelopmentRegion':'en','CFBundleExecutable':'$(EXECUTABLE_NAME)','CFBundleIdentifier':'$(PRODUCT_BUNDLE_IDENTIFIER)','CFBundleInfoDictionaryVersion':'6.0','CFBundleName':'$(PRODUCT_NAME)','CFBundleShortVersionString':'$(MARKETING_VERSION)','CFBundleVersion':'$(CURRENT_PROJECT_VERSION)','PockitAppGroup':'$(POCKIT_APP_GROUP)'}
app=dict(base,CFBundlePackageType='APPL',CFBundleDisplayName='Pockit',LSRequiresIPhoneOS=True,UILaunchScreen={},UISupportedInterfaceOrientations=['UIInterfaceOrientationPortrait','UIInterfaceOrientationLandscapeLeft','UIInterfaceOrientationLandscapeRight'],CFBundleURLTypes=[{'CFBundleURLName':'com.alinikan.pockit','CFBundleURLSchemes':['pockit']}],NSCameraUsageDescription='Scan a receipt you choose to add to Pockit.',NSPhotoLibraryUsageDescription='Choose a receipt image to read on your device.')
widget=dict(base,CFBundlePackageType='XPC!',NSExtension={'NSExtensionPointIdentifier':'com.apple.widgetkit-extension'})
for path,value in [('App/Info.plist',app),('Widget/Info.plist',widget),('App/Pockit.entitlements',{'com.apple.security.application-groups':['$(POCKIT_APP_GROUP)']}),('Widget/PockitWidget.entitlements',{'com.apple.security.application-groups':['$(POCKIT_APP_GROUP)']})]:
    (root/path).write_bytes(plistlib.dumps(value))
scheme=root/'Pockit.xcodeproj/xcshareddata/xcschemes'
scheme.mkdir(parents=True,exist_ok=True)
(scheme/'Pockit.xcscheme').write_text(f'''<?xml version="1.0" encoding="UTF-8"?>
<Scheme LastUpgradeVersion="2700" version="1.3"><BuildAction parallelizeBuildables="YES" buildImplicitDependencies="YES"><BuildActionEntries><BuildActionEntry buildForTesting="YES" buildForRunning="YES" buildForProfiling="YES" buildForArchiving="YES" buildForAnalyzing="YES"><BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="{targets['Pockit']}" BuildableName="Pockit.app" BlueprintName="Pockit" ReferencedContainer="container:Pockit.xcodeproj"/></BuildActionEntry></BuildActionEntries></BuildAction><LaunchAction buildConfiguration="Debug" selectedDebuggerIdentifier="Xcode.DebuggerFoundation.Debugger.LLDB" selectedLauncherIdentifier="Xcode.IDEFoundation.Launcher.LLDB" launchStyle="0" useCustomWorkingDirectory="NO" ignoresPersistentStateOnLaunch="NO" debugDocumentVersioning="YES" debugServiceExtension="internal" allowLocationSimulation="YES"><BuildableProductRunnable runnableDebuggingMode="0"><BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="{targets['Pockit']}" BuildableName="Pockit.app" BlueprintName="Pockit" ReferencedContainer="container:Pockit.xcodeproj"/></BuildableProductRunnable></LaunchAction><ArchiveAction buildConfiguration="Release" revealArchiveInOrganizer="YES"/></Scheme>''')
print('Generated',project)
