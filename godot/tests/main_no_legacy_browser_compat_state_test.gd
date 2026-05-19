extends Node

const MAIN_SCRIPT_PATH := "res://scripts/main.gd"

const FORBIDDEN_MARKERS := [
	"const CharacterDetailPanelScript",
	"const FactionDetailPanelScript",
	"var character_detail_panel",
	"var selected_character_button",
	"var selected_character_id",
	"var character_list_box",
	"var character_row_buttons",
	"var faction_detail_panel",
	"var selected_faction_button",
	"var selected_faction_id",
	"var faction_list_box",
	"var faction_row_buttons",
	"func _sync_character_browser_compat(",
	"func _sync_faction_browser_compat("
]

func _ready() -> void:
	var file := FileAccess.open(MAIN_SCRIPT_PATH, FileAccess.READ)
	if file == null:
		_fail("Could not read main.gd")
		return
	var source: String = file.get_as_text()
	for marker in FORBIDDEN_MARKERS:
		if source.contains(str(marker)):
			_fail("Main scene still contains legacy browser compatibility state marker: %s" % str(marker))
			return
	print("[TianmingGodotTest] main no legacy browser compatibility state scene test passed")
	_finish(0)

func _fail(message: String) -> void:
	print("[TianmingGodotTest] main no legacy browser compatibility state scene test failed: %s" % message)
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] main no legacy browser compatibility state scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
