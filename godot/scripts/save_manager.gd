extends RefCounted

class_name SaveManager

const SAVE_DIR := "user://saves"
const SAVE_EXTENSION := ".json"
const DEFAULT_SLOT_IDS := ["quick", "slot_1", "slot_2", "slot_3"]
const SUPPORTED_SAVE_FORMATS := ["tianming-godot-save-v1"]

func save_to_slot(state: RefCounted, slot_id: String) -> Dictionary:
	if state == null or not state.has_method("create_save_snapshot"):
		return {
			"ok": false,
			"error": "state does not support save snapshots"
		}
	var ensure_result: Dictionary = _ensure_save_dir()
	if not ensure_result.get("ok", false):
		return ensure_result

	var snapshot: Dictionary = state.call("create_save_snapshot")
	snapshot["slot_id"] = _clean_slot_id(slot_id)
	snapshot["saved_at_unix"] = Time.get_unix_time_from_system()
	var path: String = _slot_path(slot_id)
	var file: FileAccess = FileAccess.open(path, FileAccess.WRITE)
	if file == null:
		return {
			"ok": false,
			"error": "could not open save slot for writing: %d" % FileAccess.get_open_error()
		}
	file.store_string(JSON.stringify(snapshot, "\t"))
	file.close()
	return {
		"ok": true,
		"path": path,
		"metadata": _metadata_from_snapshot(snapshot, true)
	}

func load_slot(slot_id: String) -> Dictionary:
	var path: String = _slot_path(slot_id)
	if not FileAccess.file_exists(path):
		return {
			"ok": false,
			"error": "save slot does not exist"
		}
	var file: FileAccess = FileAccess.open(path, FileAccess.READ)
	if file == null:
		return {
			"ok": false,
			"error": "could not open save slot for reading: %d" % FileAccess.get_open_error()
		}
	var text: String = file.get_as_text()
	file.close()
	var json: JSON = JSON.new()
	var parse_error: Error = json.parse(text)
	if parse_error != OK:
		return {
			"ok": false,
			"error": "could not parse save slot: %s" % json.get_error_message()
		}
	var snapshot: Dictionary = _dict(json.data)
	if snapshot.is_empty():
		return {
			"ok": false,
			"error": "save slot does not contain a snapshot"
		}
	return {
		"ok": true,
		"path": path,
		"snapshot": snapshot,
		"metadata": _metadata_from_snapshot(snapshot, true)
	}

func restore_slot(state: RefCounted, slot_id: String) -> Dictionary:
	if state == null or not state.has_method("restore_save_snapshot"):
		return {
			"ok": false,
			"error": "state does not support save restores"
		}
	var load_result: Dictionary = load_slot(slot_id)
	if not load_result.get("ok", false):
		return load_result
	var metadata: Dictionary = _dict(load_result.get("metadata", {}))
	if not bool(metadata.get("compatible", false)):
		return {
			"ok": false,
			"error": str(metadata.get("version_warning", "unsupported save format")),
			"metadata": metadata
		}
	var restore_result: Dictionary = state.call("restore_save_snapshot", _dict(load_result.get("snapshot", {})))
	if not restore_result.get("ok", false):
		return restore_result
	return {
		"ok": true,
		"path": str(load_result.get("path", "")),
		"metadata": _dict(load_result.get("metadata", {}))
	}

func slot_metadata(slot_id: String) -> Dictionary:
	var load_result: Dictionary = load_slot(slot_id)
	if not load_result.get("ok", false):
		return {
			"exists": false,
			"slot_id": _clean_slot_id(slot_id),
			"error": str(load_result.get("error", ""))
		}
	return _dict(load_result.get("metadata", {}))

func list_slots(slot_ids: Array = DEFAULT_SLOT_IDS) -> Array:
	var rows: Array = []
	for raw_id in slot_ids:
		rows.append(slot_metadata(str(raw_id)))
	return rows

func delete_slot(slot_id: String) -> Dictionary:
	var path: String = _slot_path(slot_id)
	if not FileAccess.file_exists(path):
		return {
			"ok": true,
			"deleted": false
		}
	var error: Error = DirAccess.remove_absolute(ProjectSettings.globalize_path(path))
	if error != OK:
		return {
			"ok": false,
			"error": "could not delete save slot: %d" % error
		}
	return {
		"ok": true,
		"deleted": true
	}

func _metadata_from_snapshot(snapshot: Dictionary, exists: bool) -> Dictionary:
	var state: Dictionary = _dict(snapshot.get("state", {}))
	var format: String = str(snapshot.get("format", ""))
	var compatible: bool = _is_supported_save_format(format)
	var action_points: int = int(_number(state.get("action_points", 0)))
	var treasury_money: float = _number(state.get("guoku_money", 0))
	var inner_treasury_money: float = _number(state.get("neitang_money", 0))
	var huangwei: float = _number(state.get("huangwei", 0))
	var minxin: float = _number(state.get("minxin", 0))
	return {
		"exists": exists,
		"slot_id": str(snapshot.get("slot_id", "")),
		"format": format,
		"compatible": compatible,
		"version_warning": "" if compatible else "unsupported save format: %s" % format,
		"scenario_name": str(snapshot.get("scenario_name", "")),
		"turn": int(_number(state.get("turn", 0))),
		"year": int(_number(state.get("year", 0))),
		"month": int(_number(state.get("month", 0))),
		"saved_at_unix": float(_number(snapshot.get("saved_at_unix", 0))),
		"action_points": action_points,
		"treasury_money": treasury_money,
		"inner_treasury_money": inner_treasury_money,
		"huangwei": huangwei,
		"minxin": minxin,
		"summary_text": "AP %d · 国库 %.1f万两 · 内帑 %.1f万两 · 皇威 %.0f · 民心 %.0f" % [
			action_points,
			treasury_money / 10000.0,
			inner_treasury_money / 10000.0,
			huangwei,
			minxin
		]
	}

func _is_supported_save_format(format: String) -> bool:
	return SUPPORTED_SAVE_FORMATS.has(format)

func _ensure_save_dir() -> Dictionary:
	var absolute: String = ProjectSettings.globalize_path(SAVE_DIR)
	var error: Error = DirAccess.make_dir_recursive_absolute(absolute)
	if error != OK:
		return {
			"ok": false,
			"error": "could not create save directory: %d" % error
		}
	return {"ok": true}

func _slot_path(slot_id: String) -> String:
	return "%s/%s%s" % [SAVE_DIR, _clean_slot_id(slot_id), SAVE_EXTENSION]

func _clean_slot_id(slot_id: String) -> String:
	var raw: String = slot_id.strip_edges()
	if raw.is_empty():
		raw = "quick"
	var cleaned: String = ""
	for i in range(raw.length()):
		var ch: String = raw.substr(i, 1)
		if ch.is_valid_identifier() or ch.is_valid_int() or ch == "-":
			cleaned += ch
		else:
			cleaned += "_"
	if cleaned.is_empty():
		return "quick"
	return cleaned

func _number(value: Variant) -> float:
	if typeof(value) == TYPE_INT or typeof(value) == TYPE_FLOAT:
		return float(value)
	return str(value).to_float()

func _dict(value: Variant) -> Dictionary:
	return value if typeof(value) == TYPE_DICTIONARY else {}
