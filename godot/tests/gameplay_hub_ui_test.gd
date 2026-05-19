extends Node

const MainScene := preload("res://scenes/main.tscn")

func _ready() -> void:
	var main: Node = MainScene.instantiate()
	add_child(main)
	await get_tree().process_frame

	var tabs: TabContainer = _find_first_tab_container(main)
	if tabs == null:
		_fail("Main scene does not expose a gameplay tab container")
		return
	if tabs.get_child_count() == 0 or tabs.get_child(0).name != "御览":
		_fail("Gameplay hub should be the first tab")
		return

	var hub: Node = _find_node_with_script(main, "res://scripts/gameplay_hub_panel.gd")
	if hub == null:
		_fail("Main scene does not expose the gameplay hub panel")
		return
	if not hub.has_signal("advance_month_requested") or not hub.has_signal("tab_requested"):
		_fail("Gameplay hub does not expose gameplay navigation signals")
		return
	if not hub.has_signal("save_requested") or not hub.has_signal("load_requested"):
		_fail("Gameplay hub does not expose save/load signals")
		return

	var game_state: RefCounted = main.get("game_state") as RefCounted
	if game_state == null:
		_fail("Main scene did not initialize GameState")
		return

	var turn_before: int = int(game_state.get("turn"))
	hub.emit_signal("save_requested")
	await get_tree().process_frame
	hub.emit_signal("advance_month_requested")
	await get_tree().process_frame
	if int(game_state.get("turn")) != turn_before + 1:
		_fail("Gameplay hub next-month signal did not advance game state")
		return
	hub.emit_signal("load_requested")
	await get_tree().process_frame
	if int(game_state.get("turn")) != turn_before:
		_fail("Gameplay hub load signal did not restore the saved game state")
		return

	hub.emit_signal("tab_requested", "外交")
	await get_tree().process_frame
	if tabs.get_current_tab_control() == null or tabs.get_current_tab_control().name != "外交":
		_fail("Gameplay hub tab navigation did not switch to diplomacy")
		return

	var snapshot: Dictionary = game_state.call("gameplay_hub_snapshot", false)
	if int(snapshot.get("action_points", -1)) < 0 or str(snapshot.get("date", "")).is_empty():
		_fail("Gameplay hub snapshot does not contain playable turn state")
		return
	var save_manager: RefCounted = main.get("save_manager") as RefCounted
	if save_manager != null and save_manager.has_method("delete_slot"):
		save_manager.call("delete_slot", "quick")

	print("[TianmingGodotTest] gameplay hub UI scene test passed")
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

func _fail(message: String) -> void:
	print("[TianmingGodotTest] gameplay hub UI scene test failed: %s" % message)
	push_error(message)
	get_tree().create_timer(5.0).timeout.connect(func() -> void: _finish(1))

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] gameplay hub UI scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
