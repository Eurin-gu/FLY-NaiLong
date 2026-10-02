# 背景音乐

游戏开局时会循环播放这里的音乐。文件按下面命名即可，不用改代码：

| 文件 | 用途 |
| --- | --- |
| `bgm.ogg` | 优先使用。`<audio loop>` 在 ogg 下接缝是无缝的 |
| `bgm.mp3` | 浏览器不支持 ogg 时的后备（mp3 循环会有一点编码器补帧的缝隙） |

浏览器支持 ogg 就用 ogg，否则用 mp3。两个都放最稳。

## 注意：这两个文件默认不进仓库

见同目录的 `.gitignore`。本仓库是公开的，**不要提交你没有分发授权的商业曲目**。
本地开发和你自己的私有部署不受影响。

## 转码参考

```bash
# 顺手削掉结尾静音，否则循环会有一段空档
ffmpeg -i input.flac -t 113.2 -af loudnorm=I=-16:TP=-1.5:LRA=11 \
  -c:a libvorbis -q:a 4 -ar 44100 bgm.ogg
ffmpeg -i input.flac -t 113.2 -af loudnorm=I=-16:TP=-1.5:LRA=11 \
  -c:a libmp3lame -b:a 128k -ar 44100 bgm.mp3
```

## 需要免费可商用的替代曲目

- [Kenney Music Jingles / Music Loops](https://kenney.nl/assets/tag:audio) — CC0
- [Free Music Archive](https://freemusicarchive.org/) — 按 CC0 / CC-BY 筛选
- [OpenGameArt 音乐区](https://opengameart.org/art-search-advanced?field_art_type_tid%5B%5D=12) — 按 CC0 筛选
- [Incompetech](https://incompetech.com/music/royalty-free/) — CC-BY，需署名