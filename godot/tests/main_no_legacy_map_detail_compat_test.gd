extends Node

const MAIN_SCRIPT_PATH := "res://scripts/main.gd"

const FORBIDDEN_MARKERS := [
	"var map_detail_title",
	"var map_detail_owner",
	"var map_detail_stats",
	"var map_detail_resources",
	"var map_detail_neighbors",
	"var map_detail_prefectures",
	"var map_quick_status",
	"const WorldMapViewScript",
	"var selected_map_region",
	"var world_map_view",
	"func _sync_world_map_panel_compat(",
	"func _on_map_region_selected(",
	"func _clear_map_region_selection(",
	"func _selected_map_region_id("
]

func _ready() -> void:
	var file := FileAccess.open(MAIN_SCRIPT_PATH, FileAccess.READ)
	if file == null:
		_fail("Could not read main.gd")
		return
	var source: String = file.get_as_text()
	for marker in FORBIDDEN_MARKERS:
		if source.contains(str(marker)):
			_fail("Main scene still contains legacy map detail compatibility marker: %s" % str(marker))
			return
	print("[TianmingGodotTest] main no legacy map detail compatibility scene test passed")
	_finish(0)

func _fail(message: String) -> void:
	print("[TianmingGodotTest] main no legacy map detail compatibility scene test failed: %s" % message)
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] main no legacy map detail compatibility scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
