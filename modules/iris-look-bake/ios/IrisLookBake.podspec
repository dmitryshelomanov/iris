Pod::Spec.new do |s|
  s.name           = 'IrisLookBake'
  s.version        = '1.0.0'
  s.summary        = 'Iris look bake + on-device AnimeGANv3 stylization'
  s.description    = 'Video look bake and AnimeGANv3 photo stylization for Iris'
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = {
    :ios => '16.4',
    :tvos => '16.4'
  }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  # ONNX Runtime with CoreML execution provider on Apple Silicon / Neural Engine.
  s.dependency 'onnxruntime-objc', '~> 1.20.0'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
  # ONNX must live under this pod root (ios/). Paths like ../assets/models are dropped by
  # CocoaPods and leave IrisLookBake.bundle empty. Keep ios/*.onnx symlinks → assets/models.
  s.resource_bundles = {
    'IrisLookBake' => [
      'AnimeGANv3_Shinkai_37.onnx',
      'AnimeGANv3_Hayao_36.onnx',
    ]
  }
end
