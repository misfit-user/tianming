extends Node

const MAIN_SCRIPT_PATH := "res://scripts/main.gd"

const FORBIDDEN_MARKERS := [
	"func _make_faction_button(",
	"func _add_faction_row_button(",
	"func _on_faction_selected(",
	"func _refresh_faction_list_buttons(",
	"func _prune_faction_list_buttons(",
	"func _update_faction_button(",
	"func _add_map_detail_panel(",
	"func _add_detail_value(",
	"func _make_character_button(",
	"func _add_character_row_button(",
	"func _on_character_selected(",
	"func _refresh_character_list_buttons(",
	"func _prune_character_list_buttons(",
	"func _update_character_button(",
	"func _make_cell(",
	"func _set_button_cell_texts(",
	"func _remove_row_button(",
	"func _add_data_tabs(summary: Dictionary)",
	"var faction_columns",
	"var character_columns",
	"var faction_rows",
	"var character_rows",
	"summary.get(\"faction_rows\"",
	"summary.get(\"character_rows\"",
	"summary.get(\"map_view\"",
	"_add_faction_tab(tabs, faction_rows, faction_columns)",
	"_add_character_tab(tabs, character_rows, character_columns)",
	"func _add_faction_tab(tabs: TabContainer, rows: Array, _columns: Array)",
	"func _add_character_tab(tabs: TabContainer, rows: Array, _columns: Array)"
]

func _ready() -> void:
	var file := FileAccess.open(MAIN_SCRIPT_PATH, FileAccess.READ)
	if file == null:
		_fail("Could not read main.gd")
		return
	var source: String = file.get_as_text()
	for marker in FORBIDDEN_MARKERS:
		if source.contains(str(marker)):
			_fail("Main scene still contains legacy browser fallback marker: %s" % str(marker))
			return
	print("[TianmingGodotTest] main no legacy browser fallback scene test passed")
	_finish(0)

func _fail(message: String) -> void:
	print("[TianmingGodotTest] main no legacy browser fallback scene test failed: %s" % message)
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] main no legacy browser fallback scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
