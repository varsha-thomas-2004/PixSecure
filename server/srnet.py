import torch
from torch import nn

class ConvBn(nn.Module):
    def __init__(self, in_channels: int, out_channels: int):
        super().__init__()
        self.conv = nn.Conv2d(in_channels, out_channels, kernel_size=3, stride=1, padding=1, bias=False)
        self.bn = nn.BatchNorm2d(out_channels)
    def forward(self, inp):
        return self.bn(self.conv(inp))

class Type1(nn.Module):
    def __init__(self, in_channels: int, out_channels: int):
        super().__init__()
        self.convbn = ConvBn(in_channels, out_channels)
        self.relu = nn.ReLU()
    def forward(self, inp):
        return self.relu(self.convbn(inp))

class Type2(nn.Module):
    def __init__(self, in_channels: int, out_channels: int):
        super().__init__()
        self.type1 = Type1(in_channels, out_channels)
        self.convbn = ConvBn(in_channels, out_channels)
    def forward(self, inp):
        return inp + self.convbn(self.type1(inp))

class Type3(nn.Module):
    def __init__(self, in_channels: int, out_channels: int):
        super().__init__()
        self.conv1 = nn.Conv2d(in_channels, out_channels, kernel_size=1, stride=2, padding=0, bias=False)
        self.batch_norm = nn.BatchNorm2d(out_channels)
        self.type1 = Type1(in_channels, out_channels)
        self.convbn = ConvBn(out_channels, out_channels)
        self.pool = nn.AvgPool2d(kernel_size=3, stride=2, padding=1)
    def forward(self, inp):
        return self.batch_norm(self.conv1(inp)) + self.pool(self.convbn(self.type1(inp)))

class Type4(nn.Module):
    def __init__(self, in_channels: int, out_channels: int):
        super().__init__()
        self.type1 = Type1(in_channels, out_channels)
        self.convbn = ConvBn(out_channels, out_channels)
        self.gap = nn.AdaptiveAvgPool2d(output_size=1)
    def forward(self, inp):
        return self.gap(self.convbn(self.type1(inp)))

class SRNet(nn.Module):
    """
    SRNet implementation matching brijeshiitg codebase exactly.
    """
    def __init__(self):
        super().__init__()
        self.type1s = nn.Sequential(Type1(1, 64), Type1(64, 16))
        self.type2s = nn.Sequential(
            Type2(16, 16), Type2(16, 16), Type2(16, 16), Type2(16, 16), Type2(16, 16)
        )
        self.type3s = nn.Sequential(
            Type3(16, 16), Type3(16, 64), Type3(64, 128), Type3(128, 256)
        )
        self.type4 = Type4(256, 512)
        self.dense = nn.Linear(512, 2)
        self.softmax = nn.LogSoftmax(dim=1)

    def forward(self, inp):
        out = self.type1s(inp)
        out = self.type2s(out)
        out = self.type3s(out)
        out = self.type4(out)
        out = out.view(out.size(0), -1)
        out = self.dense(out)
        return self.softmax(out)
