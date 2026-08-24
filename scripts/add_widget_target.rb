require 'xcodeproj'
require 'fileutils'

project_path = 'ios/RooAlarm.xcodeproj'
project = Xcodeproj::Project.open(project_path)

widget_target_name = 'RooAlarmWidget'
widget_bundle_id = 'com.roo.alarm.RooAlarmWidget'

# Check if target already exists
if project.targets.any? { |t| t.name == widget_target_name }
  puts "Target #{widget_target_name} already exists."
  exit 0
end

# Create group for widget files
main_group = project.main_group
widget_group = main_group.children.find { |g| g.name == widget_target_name } || main_group.new_group(widget_target_name, widget_target_name)

# Create the target
widget_target = project.new_target(:app_extension, widget_target_name, :ios, '16.0')

# Configure build settings
widget_target.build_configurations.each do |config|
  config.build_settings['PRODUCT_BUNDLE_IDENTIFIER'] = widget_bundle_id
  config.build_settings['INFOPLIST_FILE'] = "#{widget_target_name}/Info.plist"
  config.build_settings['SWIFT_VERSION'] = '5.0'
  config.build_settings['TARGETED_DEVICE_FAMILY'] = '1'
  config.build_settings['CODE_SIGN_ENTITLEMENTS'] = "#{widget_target_name}/#{widget_target_name}.entitlements"
  config.build_settings['MARKETING_VERSION'] = '1.0'
  config.build_settings['CURRENT_PROJECT_VERSION'] = '1'
  config.build_settings['DEVELOPMENT_TEAM'] = 'YW6HVLQ9JV'
  config.build_settings['SKIP_INSTALL'] = 'YES'
  config.build_settings['LD_RUNPATH_SEARCH_PATHS'] = '$(inherited) @executable_path/Frameworks @executable_path/../../Frameworks'
end

# Add files to group and target
files_to_add = [
  'RooAlarmWidget.swift',
  'RooAlarmWidgetBundle.swift',
  'Info.plist',
  "#{widget_target_name}.entitlements"
]

files_to_add.each do |file_name|
  file_path = File.join('ios', widget_target_name, file_name)
  next unless File.exist?(file_path)
  
  file_ref = widget_group.new_reference(file_name)
  if file_name.end_with?('.swift')
    widget_target.add_file_references([file_ref])
  end
end

# Add dependency to main app
main_target = project.targets.find { |t| t.name == 'RooAlarm' }
main_target.add_dependency(widget_target)

# Add Embed App Extensions build phase
embed_phase = main_target.new_copy_files_build_phase('Embed App Extensions')
embed_phase.symbol_dst_subfolder_spec = :plug_ins
embed_phase.add_file_reference(widget_target.product_reference, true)
# no-op

# Ensure App Group entitlement is added to main target
main_entitlements_path = "RooAlarm/RooAlarm.entitlements"
if File.exist?("ios/#{main_entitlements_path}")
  main_target.build_configurations.each do |config|
    config.build_settings['CODE_SIGN_ENTITLEMENTS'] = main_entitlements_path
  end
  # Add entitlements to main group if not present
  unless main_group.children.find { |g| g.name == 'RooAlarm' }.children.find { |f| f.path == 'RooAlarm.entitlements' }
    main_group.children.find { |g| g.name == 'RooAlarm' }.new_reference('RooAlarm.entitlements')
  end
end

project.save
puts "Successfully added #{widget_target_name} to project."
