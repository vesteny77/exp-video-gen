from typing import Optional, List
import sys
import os
import csv
import subprocess
from pathlib import Path

try:
    import bpy
    IN_BLENDER = True
except Exception:
    bpy = None  # type: ignore
    IN_BLENDER = False

# -------------------------
# Shared helpers
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

DEFAULT_OBJ_NAMES = [
    "CC_Base_Body",
    "CC_Base_Eye",
    "CC_Base_EyeOcclusion",
    "CC_Base_Teeth",
    "CC_Base_Tongue",
    "Eyelash",
    "CC_Base_Body.002"
]

# -------------------------
# Blender implementation
# -------------------------
def _run_named_in_blender(
    csv_path: str,
    audio_path: str,
    out_video: str,
    fps: int,
    opt_arg: Optional[str] = None,
    collection_name_arg: str = "grp_blendShapes_01",
    frames_dir: str = "/tmp",
    frames_prefix: str = "render_frames_"
) -> None:
    if not IN_BLENDER:
        raise RuntimeError("This function must be called inside Blender (bpy not found).")

    scene = bpy.context.scene
    scene.render.fps = fps
    scene.render.image_settings.file_format = 'PNG'
    scene.frame_start = 0

    frames_pattern = os.path.join(frames_dir, frames_prefix + "%04d.png")
    scene.render.filepath = os.path.join(frames_dir, frames_prefix)

    # Determine target meshes
    target_meshes = []
    if opt_arg and opt_arg.lower() == "collection":
        coll_name = collection_name_arg or "grp_blendShapes_01"
        parent_coll = bpy.data.collections.get(coll_name)
        parent_obj = bpy.data.objects.get(coll_name)
        if parent_obj:
            if parent_obj.type == 'MESH':
                target_meshes.append(parent_obj)
            for ch in get_children_recursive(parent_obj):
                if ch.type == 'MESH':
                    target_meshes.append(ch)
        elif parent_coll:
            for ob in iter_collection_objects_recursive(parent_coll):
                if ob.type == 'MESH':
                    target_meshes.append(ob)
        else:
            raise SystemExit(f"Collection or object named '{coll_name}' not found.")
    else:
        if opt_arg:
            names = [n.strip() for n in opt_arg.split(",") if n.strip()]
        else:
            names = DEFAULT_OBJ_NAMES
        print("Looking for objects by exact name:", names)
        for n in names:
            ob = bpy.data.objects.get(n)
            if ob:
                if ob.type == 'MESH':
                    target_meshes.append(ob)
                else:
                    print(f"Warning: Found object '{n}' but it is type '{ob.type}', skipping.")
            else:
                print(f"Warning: Object named '{n}' not found in blend file.")

    # Dedupe
    seen = set()
    target_meshes = [o for o in target_meshes if (o.name not in seen and not seen.add(o.name))]
    if not target_meshes:
        raise SystemExit("No target mesh objects found. Check names or switch to collection mode.")

    print("Final target mesh objects:", [o.name for o in target_meshes])

    # Verify shape keys
    mesh_keyblocks = {}
    for ob in target_meshes:
        if ob.data and getattr(ob.data, "shape_keys", None) and ob.data.shape_keys.key_blocks:
            mesh_keyblocks[ob.name] = ob.data.shape_keys.key_blocks
        else:
            print(f"Warning: Mesh '{ob.name}' has no shape keys and will be skipped.")
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

    csv_columns = [c for c in rows[0].keys() if c not in ('timeCode', '')]
    if not csv_columns:
        raise SystemExit("No CSV columns found besides 'timeCode'.")

    csv_to_shape_per_mesh = {}
    for mesh_name, key_blocks in mesh_keyblocks.items():
        mapping = {}
        for col in csv_columns:
            shape_name = col.replace("blendShapes.", "")
            if shape_name in key_blocks:
                mapping[col] = shape_name
        csv_to_shape_per_mesh[mesh_name] = mapping
        print(f"Mesh '{mesh_name}' mapped {len(mapping)} CSV columns.")

    total_mapped = sum(len(m) for m in csv_to_shape_per_mesh.values())
    if total_mapped == 0:
        raise SystemExit("No CSV columns matched any shape keys on the target meshes. Check CSV and shape key names.")

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

        if (r_idx + 1) % 200 == 0:
            print(f"Processed {r_idx+1} CSV rows...")

    print("All keyframes inserted.")

    # Render frames
    scene.render.filepath = os.path.join(frames_dir, frames_prefix)
    print("Rendering animation...")
    bpy.ops.render.render(animation=True)
    print("Render finished. Frames saved to:", frames_dir)

    # # Combine frames & audio with ffmpeg
    # ffmpeg_cmd = [
    #     "ffmpeg", "-y",
    #     "-framerate", str(fps),
    #     "-i", os.path.join(frames_dir, frames_prefix + "%04d.png"),
    #     "-i", audio_path,
    #     "-c:v", "libx264", "-pix_fmt", "yuv420p",
    #     "-c:a", "aac", "-shortest",
    #     out_video
    # ]
    # print("Running ffmpeg:", " ".join(ffmpeg_cmd))
    # subprocess.run(ffmpeg_cmd, check=True)
    # print("✅ Done! Video saved at:", out_video)

# -------------------------
# External launcher functions (system Python)
# -------------------------
def _find_blender_executable(blender_exe: Optional[str] = None) -> str:
    if blender_exe:
        be = Path(blender_exe)
        if be.is_file():
            return str(be)
        raise FileNotFoundError(f"Blender not found at: {blender_exe}")
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

def run_named_external(
    blender_exe: Optional[str],
    blend_file: str,
    csv_path: str,
    audio_path: str,
    out_video: str,
    fps: int,
    opt_arg: Optional[str] = None,
    collection_name_arg: str = None,
    extra_args: Optional[List[str]] = None
) -> subprocess.CompletedProcess:
    """
    Launch Blender to execute this script.
    - opt_arg and collection_name_arg are forwarded to the script as additional CLI args.
    """
    blender_exec = _find_blender_executable(blender_exe)
    script_file = Path(__file__).resolve()
    script_args = [str(csv_path), str(audio_path), str(out_video), str(int(fps))]
    if opt_arg:
        script_args.append(opt_arg)
    if collection_name_arg:
        script_args.append(collection_name_arg)
    if extra_args:
        script_args.extend(extra_args)
    cmd = _build_blender_cmd(blender_exec, str(blend_file), str(script_file), script_args)
    return _stream_subprocess(cmd)

# -------------------------
# CLI compatibility when invoked by Blender directly
# -------------------------
def _cli_main_blender_compatible():
    argv = sys.argv
    if "--" in argv:
        argv = argv[argv.index("--") + 1:]
    else:
        argv = []

    if len(argv) < 4:
        raise SystemExit("Usage: blender -b file.blend -P apply_blendshapes_for_named_objs.py -- csv_path audio_path out_video fps [object_list_or_collection] [collection_name_if_collection]")

    csv_path, audio_path, out_video, fps = argv[0], argv[1], argv[2], int(argv[3])
    opt_arg = argv[4] if len(argv) >= 5 else None
    collection_name_arg = argv[5] if len(argv) >= 6 else "grp_blendShapes_01"
    _run_named_in_blender(csv_path, audio_path, out_video, fps, opt_arg=opt_arg, collection_name_arg=collection_name_arg)

if __name__ == "__main__" and IN_BLENDER:
    _cli_main_blender_compatible()