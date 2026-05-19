extends RefCounted

class_name SettingsManager

const SETTINGS_PATH := "user://settings.json"

var settings: Dictionary = _default_settings()

func load_settings() -> Dictionary:
	if not FileAccess.file_exists(SETTINGS_PATH):
		settings = _default_settings()
		apply_runtime_settings()
		return {"ok": true, "settings": settings_snapshot()}
	var file: FileAccess = FileAccess.open(SETTINGS_PATH, FileAccess.READ)
	if file == null:
		return {
			"ok": false,
			"error": "could not open settings file: %d" % FileAccess.get_open_error()
		}
	var text: String = file.get_as_text()
	file.close()
	var json: JSON = JSON.new()
	var parse_error: Error = json.parse(text)
	if parse_error != OK:
		return {
			"ok": false,
			"error": "could not parse settings file: %s" % json.get_error_message()
		}
	settings = _sanitize_settings(_dict(json.data))
	apply_runtime_settings()
	return {"ok": true, "settings": settings_snapshot()}

func save_settings() -> Dictionary:
	var file: FileAccess = FileAccess.open(SETTINGS_PATH, FileAccess.WRITE)
	if file == null:
		return {
			"ok": false,
			"error": "could not open settings file for writing: %d" % FileAccess.get_open_error()
		}
	file.store_string(JSON.stringify(settings, "\t"))
	file.close()
	return {"ok": true, "settings": settings_snapshot()}

func update_setting(key: String, value: Variant) -> Dictionary:
	var next: Dictionary = settings.duplicate(true)
	next[key] = value
	settings = _sanitize_settings(next)
	apply_runtime_settings()
	return {"ok": true, "settings": settings_snapshot()}

func update_settings(values: Dictionary) -> Dictionary:
	var next: Dictionary = settings.duplicate(true)
	for key in values.keys():
		next[str(key)] = values[key]
	settings = _sanitize_settings(next)
	apply_runtime_settings()
	return save_settings()

func settings_snapshot() -> Dictionary:
	return settings.duplicate(true)

func reset_to_defaults() -> Dictionary:
	settings = _default_settings()
	apply_runtime_settings()
	return save_settings()

func delete_settings_file() -> Dictionary:
	if not FileAccess.file_exists(SETTINGS_PATH):
		return {"ok": true, "deleted": false}
	var error: Error = DirAccess.remove_absolute(ProjectSettings.globalize_path(SETTINGS_PATH))
	if error != OK:
		return {
			"ok": false,
			"error": "could not delete settings file: %d" % error
		}
	settings = _default_settings()
	apply_runtime_settings()
	return {"ok": true, "deleted": true}

func apply_runtime_settings() -> void:
	var master_bus: int = AudioServer.get_bus_index("Master")
	if master_bus >= 0:
		var volume: float = clampf(_number(settings.get("master_volume", 0.8)), 0.0, 1.0)
		AudioServer.set_bus_volume_db(master_bus, linear_to_db(maxf(volume, 0.0001)))
	var fullscreen: bool = bool(settings.get("fullscreen", false))
	if fullscreen:
		DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_FULLSCREEN)
	else:
		DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_WINDOWED)

static func _default_settings() -> Dictionary:
	return {
		"fullscreen": false,
		"ui_scale": 1.0,
		"master_volume": 0.8
	}

func _sanitize_settings(raw: Dictionary) -> Dictionary:
	return {
		"fullscreen": bool(raw.get("fullscreen", false)),
		"ui_scale": clampf(_number(raw.get("ui_scale", 1.0)), 0.8, 1.5),
		"master_volume": clampf(_number(raw.get("master_volume", 0.8)), 0.0, 1.0)
	}

func _number(value: Variant) -> float:
	if typeof(value) == TYPE_INT or typeof(value) == TYPE_FLOAT:
		return float(value)
	return str(value).to_float()

func _dict(value: Variant) -> Dictionary:
	return value if typeof(value) == TYPE_DICTIONARY else {}
