from typing import Optional, List, Tuple
import sys
import os
import csv
import subprocess
from pathlib import Path

# Try to import bpy; if not present we are in system Python
try:
    import bpy
    IN_BLENDER = True
except Exception:
    bpy = None  # type: ignore
    IN_BLENDER = False

# -------------------------
# Common helpers (works in both envs)
# -------------------------
def parse_time_to_seconds(tc):
    try:
        return float(tc)
    except:
        return 0.0

def iter_collection_objects_recursive(coll):
    for ob in coll.objects:
        yield ob
    for child_coll in coll.children:
        yield from iter_collection_objects_recursive(child_coll)

def get_children_recursive(obj):
    for c in obj.children:
        yield c
        yield from get_children_recursive(c)

# -------------------------
# The Blender-side implementation (only used when IN_BLENDER=True)
# -------------------------
def _run_blend_in_blender(
    csv_path: str,
    audio_path: str,
    out_video: str,
    fps: int,
    obj_name: str = "grp_blendShapes_01",
    frames_dir: str = "/tmp",
    frames_prefix: str = "render_frames_"
) -> None:
    """Run inside Blender (expects bpy)."""
    if not IN_BLENDER:
        raise RuntimeError("This function must be called inside Blender (bpy not found).")

    scene = bpy.context.scene
    scene.render.fps = fps
    scene.render.image_settings.file_format = 'PNG'
    scene.frame_start = 0

    frames_pattern = os.path.join(frames_dir, frames_prefix + "%04d.png")
    scene.render.filepath = os.path.join(frames_dir, frames_prefix)

    # Find target meshes under a named collection or object
    target_meshes = []
    parent_obj = bpy.data.objects.get(obj_name)
    parent_coll = bpy.data.collections.get(obj_name)

    if parent_obj:
        if parent_obj.type == 'MESH':
            target_meshes.append(parent_obj)
        for child in get_children_recursive(parent_obj):
            if child.type == 'MESH':
                target_meshes.append(child)
    elif parent_coll:
        for ob in iter_collection_objects_recursive(parent_coll):
            if ob.type == 'MESH':
                target_meshes.append(ob)
    else:
        raise SystemExit(f"Neither object nor collection named '{obj_name}' found in blend file.")

    # Dedupe preserving order
    seen = set()
    target_meshes = [o for o in target_meshes if (o.name not in seen and not seen.add(o.name))]

    if not target_meshes:
        raise SystemExit(f"No mesh objects found under collection/object '{obj_name}'. Make sure the collection contains mesh objects.")

    print("Found target mesh objects:", [o.name for o in target_meshes])

    # Build mesh -> key_blocks map
    mesh_keyblocks = {}
    for ob in target_meshes:
        if ob.data and getattr(ob.data, "shape_keys", None) and ob.data.shape_keys.key_blocks:
            mesh_keyblocks[ob.name] = ob.data.shape_keys.key_blocks
        else:
            print(f"Warning: Mesh '{ob.name}' has no shape keys — it will be skipped.")

    if not mesh_keyblocks:
        raise SystemExit("None of the target mesh objects have shape keys. Nothing to animate.")

    print("Meshes with shape keys:", list(mesh_keyblocks.keys()))

    # Read CSV
    rows = []
    with open(csv_path, newline='') as csvfile:
        reader = csv.DictReader(csvfile)
        for r in reader:
            if '' in r:
                del r['']
            rows.append(r)

    if not rows:
        raise SystemExit("CSV file is empty or unreadable.")

    last_seconds = parse_time_to_seconds(rows[-1].get('timeCode', 0))
    scene.frame_end = int(last_seconds * fps) + 1
    print("Frame range:", scene.frame_start, "->", scene.frame_end)

    # Map CSV columns -> shape keys per mesh
    csv_columns = [c for c in rows[0].keys() if c not in ('timeCode', '')]
    csv_to_shape_per_mesh = {}
    for mesh_name, key_blocks in mesh_keyblocks.items():
        mapping = {}
        for col in csv_columns:
            shape_name = col.replace("blendShapes.", "")
            if shape_name in key_blocks:
                mapping[col] = shape_name
        csv_to_shape_per_mesh[mesh_name] = mapping
        print(f"Mapping for mesh '{mesh_name}': {len(mapping)} matching shape keys")

    total_mapped = sum(len(m) for m in csv_to_shape_per_mesh.values())
    if total_mapped == 0:
        raise SystemExit("No CSV columns matched any shape keys in the target meshes. Check CSV column names and shape key names.")

    # Insert keyframes
    for r_idx, r in enumerate(rows):
        seconds = parse_time_to_seconds(r.get('timeCode', 0))
        frame = int(round(seconds * fps))
        if frame < scene.frame_start:
            frame = scene.frame_start
        if frame > scene.frame_end:
            frame = scene.frame_end

        for mesh_name, mapping in csv_to_shape_per_mesh.items():
            if not mapping:
                continue
            mesh_obj = bpy.data.objects.get(mesh_name)
            if not mesh_obj:
                print(f"Warning: mesh object '{mesh_name}' not found at keyframe time; skipping.")
                continue
            key_blocks = mesh_obj.data.shape_keys.key_blocks
            for csv_name, shape_name in mapping.items():
                try:
                    val = float(r.get(csv_name, 0.0))
                except:
                    val = 0.0
                kb = key_blocks.get(shape_name)
                if kb is None:
                    continue
                kb.value = val
                kb.keyframe_insert(data_path="value", frame=frame)

        if (r_idx + 1) % 100 == 0:
            print(f"Processed {r_idx+1} rows...")

    print("All keyframes inserted.")

    # Render to PNG sequence
    scene.render.filepath = os.path.join(frames_dir, frames_prefix)
    print("Rendering animation (this may take a while)...")
    bpy.ops.render.render(animation=True)
    print("Rendering complete. Frames saved to:", frames_dir)



    # Combine frames and audio
    # ffmpeg_cmd = [
    #     "ffmpeg", "-y",
    #     "-framerate", str(fps),
    #     "-i", frames_pattern := os.path.join(frames_dir, frames_prefix + "%04d.png"),
    #     "-i", audio_path,
    #     "-c:v", "libx264", "-pix_fmt", "yuv420p",
    #     "-c:a", "aac", "-shortest",
    #     out_video
    # ]
    # print("Running ffmpeg:", " ".join(ffmpeg_cmd))
    # subprocess.run(ffmpeg_cmd, check=True)
    # print("✅ Done! Video saved at:", out_video)

# -------------------------
# External launcher (system Python) implementation
# -------------------------
def _find_blender_executable(blender_exe: Optional[str] = None) -> str:
    """Locate blender executable. If blender_exe provided, validate it."""
    if blender_exe:
        be = Path(blender_exe)
        if be.is_file():
            return str(be)
        raise FileNotFoundError(f"Blender not found at: {blender_exe}")
    # fallback to PATH
    from shutil import which
    exe = which("blender") or which("blender.exe")
    if exe:
        return exe
    raise FileNotFoundError("Blender executable not found in PATH; pass blender_exe path.")

def _build_blender_cmd(blender_exec: str, blend_file: str, script_file: str, script_args: List[str]) -> List[str]:
    cmd = [
        blender_exec,
        "-b", str(blend_file),
        "-P", str(script_file),
        "--",
    ]
    cmd.extend(script_args)
    return cmd

def _stream_subprocess(cmd: List[str], env=None) -> subprocess.CompletedProcess:
    print("Running:", " ".join(cmd))
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, universal_newlines=True, env=env)
    try:
        assert proc.stdout is not None
        for line in proc.stdout:
            print(line.rstrip())
    except KeyboardInterrupt:
        print("Interrupted — terminating Blender process...")
        proc.terminate()
        proc.wait()
        raise
    return_code = proc.wait()
    return subprocess.CompletedProcess(cmd, return_code)

def run_blend_external(
    blender_exe: Optional[str],
    blend_file: str,
    csv_path: str,
    audio_path: str,
    out_video: str,
    fps: int,
    extra_args: Optional[List[str]] = None
) -> subprocess.CompletedProcess:
    """
    Launch Blender to run this script (useful from system Python).
    - blender_exe: path to blender binary or None to use PATH
    - blend_file: .blend file path
    - csv_path, audio_path, out_video, fps: forwarded to Blender script
    - extra_args: list of extra CLI args forwarded (e.g. obj_name)
    """
    blender_exec = _find_blender_executable(blender_exe)
    script_file = Path(__file__).resolve()
    script_args = [str(csv_path), str(audio_path), str(out_video), str(int(fps))]
    if extra_args:
        script_args.extend(extra_args)
    cmd = _build_blender_cmd(blender_exec, str(blend_file), str(script_file), script_args)
    return _stream_subprocess(cmd)

# -------------------------
# CLI handling: if run by Blender directly, execute Blender-side function
# -------------------------
def _cli_main_blender_compatible():
    """
    This function is called when the script is invoked by Blender:
    blender -b file.blend -P this_script.py -- csv_path audio_path out_video fps [obj_name]
    """
    argv = sys.argv
    if "--" in argv:
        argv = argv[argv.index("--") + 1:]
    else:
        argv = []

    if len(argv) < 4:
        raise SystemExit("Usage: blender -b file.blend -P apply_blendshapes_and_render_new.py -- csv_path audio_path out_video fps [obj_name]")

    csv_path, audio_path, out_video, fps = argv[0], argv[1], argv[2], int(argv[3])
    obj_name = argv[4] if len(argv) >= 5 else "grp_blendShapes_01"
    _run_blend_in_blender(csv_path, audio_path, out_video, fps, obj_name=obj_name)

# When run inside Blender directly
if __name__ == "__main__" and IN_BLENDER:
    _cli_main_blender_compatible()