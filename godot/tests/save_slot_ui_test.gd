extends Node

const MainScene := preload("res://scenes/main.tscn")

func _ready() -> void:
	var main: Node = MainScene.instantiate()
	add_child(main)
	await get_tree().process_frame

	var tabs: TabContainer = _find_first_tab_container(main)
	if tabs == null:
		_fail("Main scene does not expose a tab container")
		return
	var save_panel: Node = _find_node_with_script(main, "res://scripts/save_slot_panel.gd")
	if save_panel == null:
		_fail("Main scene does not expose the save slot panel")
		return
	if not save_panel.has_signal("save_slot_requested") or not save_panel.has_signal("load_slot_requested") or not save_panel.has_signal("delete_slot_requested"):
		_fail("Save slot panel does not expose save/load/delete signals")
		return

	var save_tab_index: int = _tab_index_by_name(tabs, "存档")
	if save_tab_index < 0:
		_fail("Main scene does not include a save tab")
		return

	var game_state: RefCounted = main.get("game_state") as RefCounted
	var save_manager: RefCounted = main.get("save_manager") as RefCounted
	if game_state == null or save_manager == null:
		_fail("Main scene did not initialize GameState and SaveManager")
		return
	var slot_id: String = "slot_1"
	if save_manager.has_method("delete_slot"):
		save_manager.call("delete_slot", slot_id)

	var turn_before: int = int(game_state.get("turn"))
	save_panel.emit_signal("save_slot_requested", slot_id)
	await get_tree().process_frame
	var metadata: Dictionary = save_manager.call("slot_metadata", slot_id)
	if not metadata.get("exists", false):
		_fail("Save slot panel did not create the selected slot")
		return

	game_state.call("advance_month")
	await get_tree().process_frame
	if int(game_state.get("turn")) != turn_before + 1:
		_fail("Preparing changed state failed")
		return
	save_panel.emit_signal("load_slot_requested", slot_id)
	await get_tree().process_frame
	if int(game_state.get("turn")) != turn_before:
		_fail("Save slot panel did not restore the selected slot")
		return

	save_panel.emit_signal("delete_slot_requested", slot_id)
	await get_tree().process_frame
	metadata = save_manager.call("slot_metadata", slot_id)
	if metadata.get("exists", false):
		_fail("Save slot panel did not delete the selected slot")
		return

	print("[TianmingGodotTest] save slot UI scene test passed")
	get_tree().create_timer(1.0).timeout.connect(func() -> void: _finish(0))

func _find_first_tab_container(root: Node) -> TabContainer:
	if root is TabContainer:
		return root as TabContainer
	for child in root.get_children():
		var found: TabContainer = _find_first_tab_container(child)
		if found != null:
			return found
	return null

func _find_node_with_script(root: Node, script_path: String) -> Node:
	var script: Script = root.get_script()
	if script != null and script.resource_path == script_path:
		return root
	for child in root.get_children():
		var found: Node = _find_node_with_script(child, script_path)
		if found != null:
			return found
	return null

func _tab_index_by_name(tabs: TabContainer, tab_name: String) -> int:
	for i in range(tabs.get_child_count()):
		if tabs.get_child(i).name == tab_name:
			return i
	return -1

func _fail(message: String) -> void:
	print("[TianmingGodotTest] save slot UI scene test failed: %s" % message)
	push_error(message)
	get_tree().create_timer(5.0).timeout.connect(func() -> void: _finish(1))

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] save slot UI scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
