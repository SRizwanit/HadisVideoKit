import { Config } from "@remotion/cli/config";

// Part 1: বেস কনফিগ। (বাকি সেটিংস রেন্ডার স্ক্রিপ্ট/workflow থেকে আসবে)
Config.setVideoImageFormat("jpeg");
Config.setCodec("h264");
Config.setOverwriteOutput(true);
